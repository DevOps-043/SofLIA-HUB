import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY, MODELS } from '../config';
import { PRIMARY_CHAT_PROMPT, buildPrimaryChatPrompt } from '../prompts/chat';
import { getApiKeyWithCache } from './api-keys';
import { COMPUTER_USE_TOOLS, COMPUTER_TOOL_NAMES, PROJECT_HUB_TOOLS, PROJECT_HUB_TOOL_NAMES, GOOGLE_WORKSPACE_TOOLS, GOOGLE_WORKSPACE_TOOL_NAMES, NATIVE_AI_TOOLS, NATIVE_AI_TOOL_NAMES } from './gemini-tools';
import { executeComputerTool, isComputerUseAvailable } from './computer-use-service';
import { createProject, deleteProject, getProjects, getTeamMembersDetailed, getTeams } from './iris-data';

// Acceso tipado a las APIs de Google Workspace expuestas por preload.ts
// Las APIs de Google Workspace (window.calendar, window.gmail, window.drive)
// están expuestas por preload.ts y tipadas en CalendarPanel.tsx.
// Aquí accedemos via (window as any) para evitar conflictos de declaración.

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
  generatedImages?: string[];
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
    sourcesContext?: string;
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
    systemInstruction += `\n\n=== PERSONALIZACION DEL USUARIO ===\n${
      p.nickname ? `Nombre: "${p.nickname}"` : ''
    }\n${p.occupation ? `Ocupacion: ${p.occupation}` : ''}\n${
      p.tone ? `Tono preferido: ${p.tone}` : ''
    }\n${p.instructions ? `Instrucciones personalizadas: ${p.instructions}` : ''}\n=====================================`;
  }

  if (options?.irisContext) {
    systemInstruction += `\n\n=== CONTEXTO DEL PROJECT HUB (IRIS) ===\n${options.irisContext}\n=====================================\n\n⚠️ REGLAS CRÍTICAS DE Project Hub (IRIS):\n1. **NO ADIVINES**: Antes de crear o actualizar en IRIS, resuelve el equipo, proyecto y responsable con las herramientas de listado. Si hay ambigüedad, dilo explícitamente en vez de inventar IDs.\n2. **CREACIÓN DE PROYECTOS**: Si el usuario pide CREAR un proyecto o tarea con un nombre específico, usa la herramienta de creación. Nunca desvíes la acción a un proyecto existente solo por similitud de nombre.\n3. **COHERENCIA DE DOMINIO**: No mezcles un proyecto con un equipo distinto ni asignes responsables que no pertenezcan al equipo resuelto.\n4. **ASIGNACIONES**: Si el responsable no queda claro, consulta miembros del equipo antes de crear la tarea.`;
  }

  if (options?.sourcesContext) {
    systemInstruction += options.sourcesContext;
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

  // Build tools array — only functionDeclarations (no googleSearch)
  // googleSearch (built-in) cannot be combined with custom tools in any Gemini model.
  const computerUseEnabled = isComputerUseAvailable();

  let modelTools: any[];

  // Verificar si hay calendario/Gmail/Drive conectados para habilitar Google Workspace tools
  const hasGoogleWorkspace = typeof window !== 'undefined' && !!(window as any).calendar;

  modelTools = computerUseEnabled
    ? [COMPUTER_USE_TOOLS, PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS]
    : [PROJECT_HUB_TOOLS, NATIVE_AI_TOOLS];
  if (hasGoogleWorkspace) modelTools.push(GOOGLE_WORKSPACE_TOOLS);

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
  const allGeneratedImages: string[] = [];

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

        return { stream, sources: Promise.resolve(sources), toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined, generatedImages: allGeneratedImages.length > 0 ? allGeneratedImages : undefined };
      }

      // Execute each function call
      const functionResponses: Array<{ functionResponse: { name: string; response: any } }> = [];

      for (const part of functionCalls) {
        const fc = (part as any).functionCall;
        const toolName = fc.name;
        const toolArgs = fc.args || {};

        // Check if this is a computer-use, project hub, or Google Workspace tool
        if (COMPUTER_TOOL_NAMES.has(toolName) || PROJECT_HUB_TOOL_NAMES.has(toolName) || GOOGLE_WORKSPACE_TOOL_NAMES.has(toolName) || NATIVE_AI_TOOL_NAMES.has(toolName)) {
          const toolInfo: ToolCallInfo = { name: toolName, args: toolArgs };

          // Notify UI about tool execution
          options?.onToolCall?.(toolInfo);

          try {
            let resultStr = '';
            
            if (GOOGLE_WORKSPACE_TOOL_NAMES.has(toolName)) {
              resultStr = await executeGoogleWorkspaceTool(toolName, toolArgs);
            } else if (PROJECT_HUB_TOOL_NAMES.has(toolName)) {
              if (toolName === 'delete_iris_project') {
                const deleteResult = await deleteProject(toolArgs.project_id);
                resultStr = JSON.stringify(deleteResult);
              } else if (toolName === 'get_iris_teams') {
                const teams = await getTeams();
                resultStr = JSON.stringify({ teams });
              } else if (toolName === 'get_iris_projects') {
                const projects = await getProjects(toolArgs.team_id || toolArgs.team_name);
                resultStr = JSON.stringify({ projects });
              } else if (toolName === 'get_iris_team_members') {
                const teamRef = toolArgs.team_id || toolArgs.team_name;
                if (!teamRef) {
                  resultStr = JSON.stringify({ success: false, error: 'Debes indicar team_id o team_name.' });
                } else {
                  const members = await getTeamMembersDetailed(teamRef);
                  resultStr = JSON.stringify({ members });
                }
              } else if (toolName === 'create_iris_project') {
                const createResult = await createProject({
                  name: toolArgs.project_name,
                  key: toolArgs.project_key,
                  description: toolArgs.project_description || '',
                  team_id: toolArgs.team_id || undefined,
                  team_name: toolArgs.team_name || undefined,
                });
                resultStr = JSON.stringify(createResult);
              } else if (toolName === 'create_iris_issue') {
                const { createIrisIssue } = await import('./iris-data');
                const createResult = await createIrisIssue({
                  title: toolArgs.title,
                  description: toolArgs.description || '',
                  team_id: toolArgs.team_id,
                  team_name: toolArgs.team_name,
                  project_id: toolArgs.project_id,
                  project_name: toolArgs.project_name,
                  status_id: toolArgs.status_id,
                  status_name: toolArgs.status_name,
                  priority_id: toolArgs.priority_id,
                  priority_name: toolArgs.priority_name,
                  assignee_id: toolArgs.assignee_id,
                  assignee_name: toolArgs.assignee_name,
                });
                resultStr = JSON.stringify(createResult);
              } else if (toolName === 'get_iris_statuses') {
                const { getStatuses } = await import('./iris-data');
                const teamRef = toolArgs.team_id || toolArgs.team_name;
                const statuses = teamRef ? await getStatuses(teamRef) : [];
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
            } else if (NATIVE_AI_TOOL_NAMES.has(toolName)) {
              if (toolName === 'generate_image') {
                const { generateImage } = await import('./image-generation');
                try {
                  const imgResult = await generateImage(toolArgs.prompt);
                  if (imgResult.imageData) {
                    allGeneratedImages.push(imgResult.imageData);
                    resultStr = JSON.stringify({ success: true, message: `Imagen generada correctamente: "${toolArgs.prompt}". Será mostrada en la pantalla del usuario automáticamente.` });
                  } else {
                    resultStr = JSON.stringify({ success: false, error: imgResult.text });
                  }
                } catch (e: any) {
                  resultStr = JSON.stringify({ success: false, error: e.message });
                }
              } else {
                resultStr = JSON.stringify({ success: false, error: 'Native tool not implemented' });
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

        return { stream, sources: Promise.resolve(sources), toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined, generatedImages: allGeneratedImages.length > 0 ? allGeneratedImages : undefined };
      }

      // Send function responses back to the model
      response = await chatSession.sendMessage(functionResponses as any);
    }

    // If we hit max iterations, return what we have
    const fallbackText = 'He ejecutado las acciones solicitadas. Si necesitas algo más, no dudes en pedirlo.';
    const stream = (async function* () { yield fallbackText; })();
    return { stream, sources: Promise.resolve(null), toolCalls: allToolCalls, generatedImages: allGeneratedImages.length > 0 ? allGeneratedImages : undefined };
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
    }
    catch {
      return null;
    }
  })();

  return { stream, sources, generatedImages: allGeneratedImages.length > 0 ? allGeneratedImages : undefined };
}

/**
 * Ejecuta una herramienta de Google Workspace vía IPC (window.calendar, window.gmail, window.drive).
 */
async function executeGoogleWorkspaceTool(toolName: string, args: Record<string, any>): Promise<string> {
  const cal = (window as any).calendar;
  const gmail = (window as any).gmail;
  const drive = (window as any).drive;

  switch (toolName) {
    case 'google_calendar_get_connections': {
      if (!cal) return JSON.stringify({ error: 'Calendario no disponible. El usuario debe conectar su calendario primero desde la sección de Productividad.' });
      const connections = await cal.getConnections();
      return JSON.stringify({ connections });
    }
    case 'google_calendar_get_events': {
      if (!cal) return JSON.stringify({ error: 'Calendario no conectado.' });
      const events = await cal.getEvents();
      // Si se especificó una fecha, filtrar eventos del día
      if (args.date && events && Array.isArray(events)) {
        const targetDate = args.date;
        const filtered = events.filter((e: any) => {
          const eventDate = (e.start?.dateTime || e.start?.date || '').slice(0, 10);
          return eventDate === targetDate;
        });
        return JSON.stringify({ events: filtered, date: targetDate });
      }
      return JSON.stringify({ events });
    }
    case 'google_calendar_create': {
      if (!cal) return JSON.stringify({ error: 'Calendario no conectado.' });
      const result = await cal.createEvent({
        summary: args.title,
        start: { dateTime: args.start },
        end: { dateTime: args.end },
        description: args.description || '',
        location: args.location || '',
      });
      return JSON.stringify(result);
    }
    case 'google_calendar_delete': {
      if (!cal) return JSON.stringify({ error: 'Calendario no conectado.' });
      const result = await cal.deleteEvent(args.event_id);
      return JSON.stringify(result);
    }
    case 'gmail_get_messages': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      const messages = await gmail.getMessages({
        query: args.query,
        maxResults: args.max_results || 10,
        labelIds: args.label_ids,
        pageToken: args.page_token,
      });
      return JSON.stringify(messages);
    }
    case 'gmail_read_message': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      const message = await gmail.getMessage(args.message_id);
      return JSON.stringify(message);
    }
    case 'gmail_send': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      const result = await gmail.send({
        to: Array.isArray(args.to) ? args.to : String(args.to).split(',').map((item: string) => item.trim()).filter(Boolean),
        subject: args.subject,
        body: args.body,
        isHtml: args.is_html || false,
        attachmentPaths: args.attachment_paths,
      });
      return JSON.stringify(result);
    }
    case 'gmail_get_labels': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.getLabels());
    }
    case 'gmail_preview_organization': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.previewOrganization({
        query: args.query,
        maxMessages: args.max_messages,
        minGroupSize: args.min_group_size,
        removeFromInbox: args.remove_from_inbox,
        pageLimit: args.page_limit,
      }));
    }
    case 'gmail_apply_organization_plan': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.applyOrganizationPlan(args.plan_id, {
        removeFromInbox: args.remove_from_inbox,
      }));
    }
    case 'gmail_undo_organization_plan': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.undoOrganizationPlan(args.plan_id));
    }
    case 'gmail_create_label': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.createLabel(args.name));
    }
    case 'gmail_delete_label': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.deleteLabel(args.label_id));
    }
    case 'gmail_modify_labels': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.modifyLabels(args.message_id, args.add_labels, args.remove_labels));
    }
    case 'gmail_batch_empty_label': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.batchModifyByLabel(args.label_id, { deleteLabel: args.delete_label || false }));
    }
    case 'gmail_empty_all_labels': {
      if (!gmail) return JSON.stringify({ error: 'Gmail no conectado.' });
      return JSON.stringify(await gmail.emptyAndDeleteAllLabels());
    }
    case 'drive_list_files': {
      if (!drive) return JSON.stringify({ error: 'Google Drive no conectado.' });
      const files = args.query
        ? await drive.search(args.query)
        : await drive.listFiles({ maxResults: args.max_results || 20 });
      return JSON.stringify(files);
    }
    case 'drive_search': {
      if (!drive) return JSON.stringify({ error: 'Google Drive no conectado.' });
      return JSON.stringify(await drive.search(args.query));
    }
    case 'drive_download': {
      if (!drive) return JSON.stringify({ error: 'Google Drive no conectado.' });
      return JSON.stringify(await drive.download(args.file_id, args.destination_path, args.format));
    }
    case 'drive_upload': {
      if (!drive) return JSON.stringify({ error: 'Google Drive no conectado.' });
      return JSON.stringify(await drive.upload(args.file_path, { name: args.name, folderId: args.folder_id }));
    }
    case 'drive_create_folder': {
      if (!drive) return JSON.stringify({ error: 'Google Drive no conectado.' });
      return JSON.stringify(await drive.createFolder(args.name, args.parent_id));
    }
    default:
      return JSON.stringify({ error: `Herramienta Google Workspace no implementada: ${toolName}` });
  }
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
