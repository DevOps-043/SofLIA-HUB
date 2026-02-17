import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY, MODELS } from '../config';
import { PRIMARY_CHAT_PROMPT, buildPrimaryChatPrompt } from '../prompts/chat';
import { getApiKeyWithCache } from './api-keys';
import { COMPUTER_USE_TOOLS, COMPUTER_TOOL_NAMES } from './gemini-tools';
import { executeComputerTool, isComputerUseAvailable } from './computer-use-service';

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
=====================================`;
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
  // Strategy: Use 2 model instances when computer use is available.
  //   - computerModel: only functionDeclarations (for agentic loop)
  //   - searchModel: only googleSearch (for normal streaming)
  const computerUseEnabled = isComputerUseAvailable();
  const isGemini3 = activeModelId.includes('gemini-3');

  // For the agentic path: only function declarations (no googleSearch)
  // For Gemini 2.5+: can safely combine both
  const computerTools: any[] = isGemini3
    ? [COMPUTER_USE_TOOLS]
    : [{ googleSearch: {} } as any, COMPUTER_USE_TOOLS];

  const searchTools: any[] = [{ googleSearch: {} } as any];

  const model = ai.getGenerativeModel({
    model: activeModelId,
    systemInstruction,
    tools: computerUseEnabled ? computerTools : searchTools,
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
        const match = imgBase64.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
        if (match) {
          return { inlineData: { mimeType: match[1], data: match[2] } };
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

  if (computerUseEnabled) {
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

        // Check if this is a computer-use tool
        if (COMPUTER_TOOL_NAMES.has(toolName)) {
          const toolInfo: ToolCallInfo = { name: toolName, args: toolArgs };

          // Notify UI about tool execution
          options?.onToolCall?.(toolInfo);

          try {
            const resultStr = await executeComputerTool(toolName, toolArgs);
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
