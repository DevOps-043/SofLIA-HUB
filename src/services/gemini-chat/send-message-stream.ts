import { MODELS } from '../../config';
import { buildPrimaryChatPrompt } from '../../prompts/chat';
import { isComputerUseAvailable } from '../computer-use-service';
import { runAgenticLoop } from './agentic-loop';
import { getGenAI } from './client';
import { buildGeminiHistory } from './history';
import { buildMessageContent } from './message-content';
import { buildGenerationConfig, buildModelTools, resolveModelId } from './model-config';
import { withGeminiModelCall } from './resilience';
import { completedStreamResult, isAbortError, stoppedStreamResult } from './streams';
import { buildSystemInstruction } from './system-instruction';
import type { ConversationMessage, SendMessageStreamOptions, StreamResult, ToolCallInfo } from './types';
import { sendGroundedMessage, shouldUseWebGrounding } from './web-grounding';

export async function sendMessageStream(
  message: string,
  conversationHistory: ConversationMessage[] = [],
  options?: SendMessageStreamOptions,
): Promise<StreamResult> {
  const finalMessage = options?.context ? buildPrimaryChatPrompt(options.context, message) : message;
  const messageContent = buildMessageContent(finalMessage, options?.images);
  const systemInstruction = buildSystemInstruction(message, options);
  const history = buildGeminiHistory(conversationHistory);
  const generationConfig = buildGenerationConfig(options);
  const candidateModelIds = resolveCandidateModelIds(options);
  let lastError: unknown = null;

  const computerUseEnabled = isComputerUseAvailable();
  const useToolLoop = shouldUseToolLoop(message, options, computerUseEnabled);

  // Prioridad de rutas: una ORDEN de accion sobre la computadora ("abre X y
  // ejecutalo", "reproduce Y") se atiende con el loop de herramientas aunque
  // mencione palabras de investigacion ("ultima version", "reciente"). El
  // grounding web es solo para consultas informativas sin accion ejecutable.
  const actionTakesPriority = useToolLoop && hasComputerActionCommand(normalizeToolIntentText(message));
  if (!actionTakesPriority && shouldUseWebGrounding(message)) {
    return sendGroundedMessage({
      candidateModelIds,
      finalMessage,
      messageContent,
      systemInstruction,
      history,
      generationConfig,
      allToolCalls: [],
      allGeneratedImages: [],
      signal: options?.signal,
    });
  }

  const ai = await getGenAI();
  const signal = options?.signal;
  const requestOptions = signal ? { signal } : undefined;

  for (const modelId of candidateModelIds) {
    const allToolCalls: ToolCallInfo[] = [];
    const allGeneratedImages: string[] = [];
    if (signal?.aborted) return stoppedStreamResult(allToolCalls, allGeneratedImages);
    try {
      const modelParams: { model: string; systemInstruction: string; tools?: any[] } = { model: modelId, systemInstruction };
      if (useToolLoop) modelParams.tools = buildModelTools(computerUseEnabled);
      const model = ai.getGenerativeModel(modelParams);
      const chatSession = model.startChat({ history, generationConfig });

      if (useToolLoop) {
        return await runAgenticLoop({
          chatSession,
          messageContent,
          options,
          allToolCalls,
          allGeneratedImages,
          failFastOnModelError: true,
        });
      }

      const result = await withGeminiModelCall(
        'Gemini direct message',
        () => chatSession.sendMessage(messageContent, requestOptions),
        { signal },
      );
      return completedStreamResult(
        extractResponseText(result.response),
        result.response,
        allToolCalls,
        allGeneratedImages,
      );
    } catch (error) {
      // Cancelación del usuario: no reintentar con otros modelos, detener limpio.
      if (isAbortError(error, signal)) return stoppedStreamResult(allToolCalls, allGeneratedImages);
      lastError = error;
      console.warn('[GeminiChat] model attempt failed:', { modelId, error });
    }
  }

  throw lastError || new Error('No pude obtener una respuesta del asistente.');
}

function resolveCandidateModelIds(options?: SendMessageStreamOptions): string[] {
  const selected = resolveModelId(options);
  return uniqueModelIds([
    selected,
    MODELS.FALLBACK,
    MODELS.PRIMARY,
    MODELS.PRO,
  ]);
}

function uniqueModelIds(modelIds: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return modelIds.filter((modelId): modelId is string => {
    const normalized = modelId?.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function extractResponseText(response: any): string {
  try {
    if (typeof response?.text === 'function') return response.text();
  } catch {
    // Fall back to direct candidate extraction below.
  }
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.filter((part: any) => part.text).map((part: any) => part.text).join('');
}

function shouldUseToolLoop(message: string, options: SendMessageStreamOptions | undefined, computerUseEnabled: boolean): boolean {
  const normalized = normalizeToolIntentText(message);
  if (options?.irisContext || hasProjectHubIntent(normalized) || hasWorkspaceIntent(normalized) || hasNativeAiIntent(normalized)) {
    return true;
  }
  return computerUseEnabled && hasComputerUseIntent(normalized);
}

function normalizeToolIntentText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasProjectHubIntent(text: string): boolean {
  return /\b(iris|project hub|proyecto|proyectos|tarea|tareas|issue|issues|sprint|prioridad|prioridades|equipo|equipos|asignar|responsable)\b/.test(text);
}

function hasWorkspaceIntent(text: string): boolean {
  return /\b(gmail|correo|correos|email|calendar|calendario|agenda|agendar|drive|google drive|gchat|google chat|reunion|reuniones|evento|eventos)\b/.test(text);
}

function hasNativeAiIntent(text: string): boolean {
  return /\b(genera|generar|crea|crear|haz|hacer)\b.*\b(imagen|foto|ilustracion|render)\b/.test(text);
}

function hasComputerUseIntent(text: string): boolean {
  return /\b(archivo|archivos|carpeta|carpetas|directorio|directorios|documento|documentos|word|docx|escritorio|desktop|pc|computadora|sistema|ventana|pantalla|captura|screenshot|navegador|browser|url|abre|abrir|lee|leer|lista|listar|busca|buscar|mueve|mover|copia|copiar|elimina|eliminar|borra|borrar|organiza|organizar|descarga|descargar|sube|subir|ejecuta\w*|ejecutar|terminal|powershell|aplicacion|app|reproduce|reproducir|inicia|iniciar|lanza|lanzar|arranca|arrancar|instala\w*|instalar|desinstala\w*|cierra|cerrar|clic|click|presiona|presionar|escribe|escribir|configura|configurar|apaga|apagar|reinicia|reiniciar|minimiza|maximiza|juega|jugar)\b/.test(text);
}

/**
 * Orden imperativa de accion sobre la computadora (abrir, ejecutar, reproducir,
 * instalar...). Distingue "abre Minecraft y ejecutalo" (accion -> herramientas)
 * de "cual es la ultima version de Minecraft" (investigacion -> grounding web).
 * A proposito NO incluye verbos ambiguos como "busca" o sustantivos.
 */
function hasComputerActionCommand(text: string): boolean {
  return /\b(abre|abrir|abrelo|abrela|ejecuta\w*|ejecutar|inicia|iniciar|lanza|lanzar|arranca|arrancar|reproduce|reproducir|instala\w*|instalar|desinstala\w*|cierra|cerrar|apaga|apagar|reinicia|reiniciar|bloquea|bloquear|minimiza|maximiza|clic|click|presiona|presionar|teclea|organiza|organizar|mueve|mover|renombra|renombrar|elimina|eliminar|borra|borrar|juega|jugar)\b/.test(text);
}
