import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY, MODELS } from '../config';
import { PRIMARY_CHAT_PROMPT, buildPrimaryChatPrompt } from '../prompts/chat';
import { getApiKeyWithCache } from './api-keys';
import { COMPUTER_USE_TOOLS, COMPUTER_TOOL_NAMES, PROJECT_HUB_TOOLS, PROJECT_HUB_TOOL_NAMES } from './gemini-tools';
import { executeComputerTool, isComputerUseAvailable } from './computer-use-service';
import { deleteProject, createProject } from './iris-data';

export interface ConversationMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ToolCallInfo {
  name: string;
  args: Record<string, any>;
  result?: string;
}

export interface StreamResult {
  stream: AsyncIterable<string>;
  sources: Promise<Array<{ uri: string; title: string }> | null>;
  toolCalls?: ToolCallInfo[];
}

let genAI: GoogleGenerativeAI | null = null;
let currentApiKey: string | null = null;

async function getGenAI(): Promise<GoogleGenerativeAI> {
  const dbApiKey = await getApiKeyWithCache('google');

  if (dbApiKey) {
    if (!genAI || currentApiKey !== dbApiKey) {
      genAI = new GoogleGenerativeAI(dbApiKey);
      currentApiKey = dbApiKey;
    }
    return genAI;
  }

  if (!genAI || currentApiKey !== GOOGLE_API_KEY) {
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || '');
    currentApiKey = GOOGLE_API_KEY || '';
  }

  return genAI;
}

/**
 * Prepara el historial de conversacion en formato Gemini.
 */
function buildGeminiHistory(history: ConversationMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  const MAX_HISTORY = 50;
  const trimmed = history.slice(-MAX_HISTORY);

  const raw = trimmed
    .filter(msg => msg.text && msg.text.trim().length > 0)
    .map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

  while (raw.length > 0 && raw[0].role === 'model') {
    raw.shift();
  }

  const clean: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const entry of raw) {
    if (clean.length === 0 || clean[clean.length - 1].role !== entry.role) {
      clean.push(entry);
    } else {
      clean[clean.length - 1].parts[0].text += '\n' + entry.parts[0].text;
    }
  }

  if (clean.length > 0 && clean[clean.length - 1].role === 'user') {
    clean.pop();
  }

  return clean;
}

/**
 * Envia un mensaje con streaming, function calling agéntico, y contexto.
 */
export async function sendMessageStream(
  message: string,
  conversationHistory: ConversationMessage[] = [],
  options?: {
    model?: string;
    thinking?: {
      id: string;
      level?: string;
      budget?: number;
    };
    personalization?: {
      nickname?: string;
      occupation?: string;
      tone?: string;
      instructions?: string;
    };
    imageMetadata?: any;
    images?: string[];
    toolSystemPrompt?: string;
    context?: string;
    irisContext?: string;
    onToolCall?: (toolCall: ToolCallInfo) => void;
  }
): Promise<StreamResult> {
  const ai = await getGenAI();

  const isDeepAnalysis = (msg: string): boolean => {
    const deepTriggers = [
      'analiza profundamente', 'analiza a fondo', 'análisis profundo', 'análisis detallado',
      'analizar profundamente', 'analizar a fondo', 'análisis exhaustivo', 'analiza completamente',
      'análisis completo', 'profundiza', 'explica a fondo', 'explica en detalle',
      'explicación detallada', 'quiero todos los detalles', 'dime todo sobre', 'cuéntame todo',
      'análisis extenso', 'deep analysis', 'full analysis', 'dame un análisis completo'
    ];
    const lower = msg.toLowerCase();
    return deepTriggers.some(t => lower.includes(t));
  };

  // Build system instruction
  let systemInstruction = PRIMARY_CHAT_PROMPT;

  if (isDeepAnalysis(message)) {
    systemInstruction += '\n\n⚠️ INSTRUCCIÓN OBLIGATORIA: El usuario ha pedido un análisis profundo. DEBES proporcionar un análisis EXHAUSTIVO, EXTENSO y ULTRA-DETALLADO siguiendo la estructura de ANÁLISIS PROFUNDO definida.';
  }

  if (options?.personalization) {
    const p = options.personalization;
    systemInstruction += `\n\n=== PERSONALIZACION DEL USUARIO ===
${p.nickname ? `Nombre: "${p.nickname}"` : ''}
${p.occupation ? `Ocupacion: ${p.occupation}` : ''}
${p.tone ? `Tono preferido: ${p.tone}` : ''}
${p.instructions ? `Instrucciones personalizadas: ${p.instructions}` : ''}
=====================================`;
  }

  if (options?.irisContext) {
    systemInstruction += `\n\n=== CONTEXTO DEL PROJECT HUB (IRIS) ===
${options.irisContext}
=====================================

⚠️ REGLAS CRÍTICAS DE Project Hub (IRIS):
1. **CREACIÓN DE PROYECTOS**: Si el usuario pide CREAR un proyecto o tarea con un nombre específico, DEBES usar la herramienta de creación (ej. create_iris_project). NUNCA asumas que debes mapear la información a un proyecto existente solo porque comparten similitudes, a menos que el usuario indique explícitamente agregarlo al existente.
2. **ASIGNACIONES**: Si intentas crear una issue asignada al usuario (assignee_id) y recibes un error de base de datos (ej. permisos, foreign key, RLS), vuelve a intentar crear la issue pero enviando el campo 'assignee_id' vacío o nulo. No detengas el proceso, avisa al usuario después pero completa la creación.`;
  }

  if (options?.toolSystemPrompt) {
    systemInstruction += `\n\n=== INSTRUCCIONES DE HERRAMIENTA ACTIVA ===\n${options.toolSystemPrompt}\n=====================================`;
  }

  const activeModelId = options?.model || MODELS.PRIMARY;

  // Generation config
  const generationConfig: any = {
    maxOutputTokens: 16384,
  };

  if (options?.thinking) {
    if (options.thinking.level) {
      generationConfig.thinkingConfig = { thinkingLevel: options.thinking.level };
    } else if (options.thinking.budget !== undefined && options.thinking.budget > 0) {
      generationConfig.thinkingConfig = { thinkingBudget: options.thinking.budget };
    }
  }

  // Build tools array
  // Gemini 3 models do NOT support combining built-in tools (googleSearch) with
  // function calling (functionDeclarations) in the same request.
  // Strategy:
  //   - Gemini 3: ALWAYS use functionDeclarations (PROJECT_HUB_TOOLS + optional COMPUTER_USE_TOOLS)
  //     so the AI can execute IRIS actions. Google Search is sacrificed for Gemini 3.
  //   - Gemini 2.5: Can safely combine googleSearch with functionDeclarations.
  const computerUseEnabled = isComputerUseAvailable();
  const isGemini3 = activeModelId.includes('gemini-3');

  let modelTools: any[];

  if (isGemini3) {
    // Gemini 3: ONLY functionDeclarations (no googleSearch to avoid conflict)
    modelTools = computerUseEnabled
      ? [COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS]
      : [PROJECT_HUB_TOOLS];
  } else {
    // Gemini 2.5+: Can safely combine googleSearch with functionDeclarations
    modelTools = computerUseEnabled
      ? [{ googleSearch: {} } as any, COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS]
      : [{ googleSearch: {} } as any, PROJECT_HUB_TOOLS];
  }

  const model = ai.getGenerativeModel({
    model: activeModelId,
    systemInstruction,
    tools: modelTools,
  });

  // Build final message
  let finalMessage = message;
  if (options?.context) {
    finalMessage = buildPrimaryChatPrompt(options.context, message);
  }

  // Build history
  const history = buildGeminiHistory(conversationHistory);

  // Start chat session
  const chatSession = model.startChat({
    history,
    generationConfig,
  });

  // Build message content (text + optional images)
  let messageContent: any = finalMessage;
  if (options?.images && options.images.length > 0) {
    const imageParts = options.images
      .map(imgBase64 => {
        const match = imgBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          let mimeType = match[1];
          // Ensure it's a type Gemini supports
          if (mimeType === 'application/octet-stream' || mimeType.includes('markdown')) {
            mimeType = 'text/plain';
          }
          return { inlineData: { mimeType, data: match[2] } };
        }
        return null;
      })
      .filter(Boolean);

    if (imageParts && imageParts.length > 0) {
      messageContent = [finalMessage, ...imageParts];
    }
  }

  // Track tool calls for this message
  const allToolCalls: ToolCallInfo[] = [];

  // ─── Agentic Function Calling Loop ───────────────────────────────
  // Phase 1: Non-streaming loop for tool calls
  // Phase 2: Streaming for final text response

  // Always enable the agentic loop if computer use is available OR if there are project hub tools
  // (In practice, we always have Project Hub tools enabled in the renderer)
  const shouldRunAgenticLoop = computerUseEnabled || true; 

  if (shouldRunAgenticLoop) {
    // Use non-streaming first to detect function calls
    let response = await chatSession.sendMessage(messageContent);
    let maxIterations = 10; // Safety limit

    while (maxIterations > 0) {
      maxIterations--;
      const candidate = response.response.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      // Check if any part is a function call
      const functionCalls = parts.filter((p: any) => p.functionCall);

      if (functionCalls.length === 0) {
        // No function calls — this is the final text response
        // Extract text from the response
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        const fullText = textParts.join('');

        // Extract grounding sources
        const sources = extractSources(response.response);

        // Create a simple stream from the already-received text
        const stream = (async function* () {
          yield fullText;
        })();

        return { stream, sources: Promise.resolve(sources), toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined };
      }

      // Execute each function call
      const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];

      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const toolName = fc.name;
        const toolArgs = fc.args || {};

        // Check if this is a computer-use tool or project hub tool
        if (COMPUTER_TOOL_NAMES.has(toolName) || PROJECT_HUB_TOOL_NAMES.has(toolName)) {
          const toolInfo: ToolCallInfo = { name: toolName, args: toolArgs };

          // Notify UI about tool execution
          options?.onToolCall?.(toolInfo);

          try {
            let resultStr = '';
            
            if (PROJECT_HUB_TOOL_NAMES.has(toolName)) {
              if (toolName === 'delete_iris_project') {
                const deleteResult = await deleteProject(toolArgs.project_id);
                resultStr = JSON.stringify(deleteResult);
              } else if (toolName === 'create_iris_project') {
                const createResult = await createProject({
                  name: toolArgs.project_name,
                  key: toolArgs.project_key,
                  description: toolArgs.project_description || '',
                  team_id: toolArgs.team_id || undefined, // handle missing team_id
                });
                resultStr = JSON.stringify(createResult);
              } else if (toolName === 'create_iris_issue') {
                const { createIrisIssue } = await import('./iris-data');
                const createResult = await createIrisIssue({
                  title: toolArgs.title,
                  description: toolArgs.description || '',
                  team_id: toolArgs.team_id,
                  project_id: toolArgs.project_id,
                  status_id: toolArgs.status_id,
                  priority_id: toolArgs.priority_id,
                  assignee_id: toolArgs.assignee_id
                });
                resultStr = JSON.stringify(createResult);
              } else if (toolName === 'get_iris_statuses') {
                const { getStatuses } = await import('./iris-data');
                const statuses = await getStatuses(toolArgs.team_id);
                // Gemini function response MUST be an object, not a top-level array
                resultStr = JSON.stringify({ statuses });
              } else if (toolName === 'get_iris_priorities') {
                const { getPriorities } = await import('./iris-data');
                const priorities = await getPriorities();
                // Gemini function response MUST be an object, not a top-level array
                resultStr = JSON.stringify({ priorities });
              } else if (toolName === 'get_current_user_id') {
                const session = await (await import('./sofia-auth')).sofiaAuth.getSession();
                resultStr = JSON.stringify({ user_id: session?.user?.id });
              } else {
                resultStr = JSON.stringify({ success: false, error: 'Hub tool not implemented' });
              }
            } else {
              const rawResult = await executeComputerTool(toolName, toolArgs);
              // Ensure we return an object even for string results
              try {
                const parsed = JSON.parse(rawResult);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  resultStr = rawResult;
                } else {
                  resultStr = JSON.stringify({ result: parsed });
                }
              } catch {
                resultStr = JSON.stringify({ result: rawResult });
              }
            }
            
            toolInfo.result = resultStr;
            allToolCalls.push(toolInfo);

            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: JSON.parse(resultStr),
              },
            });
          } catch (err: any) {
            const errorResult = { success: false, error: err.message };
            toolInfo.result = JSON.stringify(errorResult);
            allToolCalls.push(toolInfo);

            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: errorResult,
              },
            });
          }
        }
      }

      if (functionResponses.length === 0) {
        // Function calls were not computer-use tools (shouldn't happen, but safety)
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        const fullText = textParts.join('');
        const sources = extractSources(response.response);

        const stream = (async function* () {
          yield fullText;
        })();

        return { stream, sources: Promise.resolve(sources), toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined };
      }

      // Send function responses back to the model
      response = await chatSession.sendMessage(functionResponses as any);
    }

    // If we hit max iterations, return what we have
    const fallbackText = 'He ejecutado las acciones solicitadas. Si necesitas algo más, no dudes en pedirlo.';
    const stream = (async function* () { yield fallbackText; })();
    return { stream, sources: Promise.resolve(null), toolCalls: allToolCalls };
  }

  // ─── Standard Streaming (no function calling) ────────────────────
  const result = await chatSession.sendMessageStream(messageContent);

  const stream = (async function* () {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  })();

  const sources = (async () => {
    try {
      const response = await result.response;
      return extractSources(response);
    } catch {
      return null;
    }
  })();

  return { stream, sources };
}

/**
 * Extract grounding sources from a Gemini response.
 */
function extractSources(response: any): Array<{ uri: string; title: string; snippet?: string }> | null {
  try {
    const metadata = response.candidates?.[0]?.groundingMetadata as any;
    if (metadata?.groundingChunks) {
      return metadata.groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any, i: number) => {
          let snippet = '';
          if (metadata.groundingSupports) {
            const support = (metadata.groundingSupports as any[]).find(
              (s: any) => s.groundingChunkIndices?.includes(i)
            );
            if (support?.segment?.text) {
              snippet = support.segment.text;
            }
          }
          return {
            uri: chunk.web.uri,
            title: chunk.web.title || 'Source',
            snippet
          };
        });
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Optimiza un prompt para un modelo de IA destino.
 */
export async function optimizePrompt(
  originalPrompt: string,
  target: 'chatgpt' | 'claude' | 'gemini'
): Promise<string> {
  const { buildOptimizationPrompt } = await import('../prompts/prompt-optimizer');
  const ai = await getGenAI();
  const model = ai.getGenerativeModel({ model: MODELS.PRO });
  const prompt = buildOptimizationPrompt(originalPrompt, target);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Resetear el cliente (si cambia la API key).
 */
export function resetClient() {
  genAI = null;
}
