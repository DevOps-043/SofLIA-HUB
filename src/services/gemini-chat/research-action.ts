import { runAgenticLoop } from './agentic-loop';
import { getGenAiClient } from './client';
import { buildModelTools } from './model-config';
import { collectStreamText, isAbortError, singleChunkStream, stoppedStreamResult } from './streams';
import type { SendMessageStreamOptions, StreamResult } from './types';
import { WEB_GROUNDING_FAILURE } from './web-grounding';

/**
 * Fase 2 del flujo "investigacion + accion local".
 *
 * La ruta de grounding solo dispone de Google Search (la API de Gemini no
 * permite mezclarla con function calling en una misma peticion), asi que una
 * peticion mixta como "investiga X y ponlo en un documento Word" investigaba
 * bien pero el modelo ALUCINABA haber creado el archivo. Esta fase toma la
 * investigacion ya verificada y ejecuta las acciones pendientes con el tool
 * loop real (crear el documento, abrirlo, etc.).
 */
export async function runResearchActionPhase(input: {
  grounded: StreamResult;
  originalMessage: string;
  systemInstruction: string;
  history: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig: Record<string, any>;
  candidateModelIds: string[];
  computerUseEnabled: boolean;
  options?: SendMessageStreamOptions;
}): Promise<StreamResult> {
  const researchText = await collectStreamText(input.grounded.stream);
  const rebuiltGrounded: StreamResult = { ...input.grounded, stream: singleChunkStream(researchText) };
  if (!researchText.trim() || researchText === WEB_GROUNDING_FAILURE) return rebuiltGrounded;

  const signal = input.options?.signal;
  // Estado visible: la investigacion termino y ahora se generan los entregables.
  input.options?.onToolCall?.({ name: 'research_actions', args: {} });
  const ai = await getGenAiClient();
  let lastError: unknown = null;

  for (const modelId of input.candidateModelIds) {
    if (signal?.aborted) return stoppedStreamResult([], [], researchText);
    try {
      const config: Record<string, any> = {
        ...input.generationConfig,
        systemInstruction: input.systemInstruction,
        tools: buildModelTools(input.computerUseEnabled, modelId),
      };
      if (signal) config.abortSignal = signal;
      const chatSession = ai.chats.create({ model: modelId, history: input.history, config });
      // Se siembran las graficas de la investigacion para que la fase de accion
      // las inyecte en el documento (chart_images de create_word_document).
      const actionResult = await runAgenticLoop({
        chatSession,
        messageContent: buildActionMessage(input.originalMessage, researchText),
        options: input.options,
        allToolCalls: [],
        allGeneratedImages: [...(input.grounded.generatedImages || [])],
        failFastOnModelError: true,
      });
      const actionText = await collectStreamText(actionResult.stream);
      const mergedImages = uniqueImages([...(input.grounded.generatedImages || []), ...(actionResult.generatedImages || [])]);
      return {
        stream: singleChunkStream(`${researchText}\n\n---\n\n${actionText}`.trim()),
        sources: input.grounded.sources,
        toolCalls: actionResult.toolCalls,
        generatedImages: mergedImages.length > 0 ? mergedImages : undefined,
      };
    } catch (error) {
      if (isAbortError(error, signal)) return stoppedStreamResult([], [], researchText);
      lastError = error;
      console.warn('[GeminiChat] research action phase attempt failed:', { modelId, error });
    }
  }

  console.warn('[GeminiChat] research action phase unavailable:', lastError);
  return {
    ...rebuiltGrounded,
    stream: singleChunkStream(
      `${researchText}\n\n---\n\nNo pude completar las acciones solicitadas sobre tus archivos (crear o abrir el documento). La investigacion quedo lista: pideme reintentarlo y la guardo sin repetir la busqueda.`,
    ),
  };
}

function uniqueImages(images: string[]): string[] {
  return Array.from(new Set(images));
}

function buildActionMessage(originalMessage: string, researchText: string): string {
  return `El usuario pidio: "${originalMessage}"

La investigacion web YA se realizo y se mostro al usuario. Este es el contenido verificado (no lo repitas ni vuelvas a investigar):
<<<INVESTIGACION
${researchText}
INVESTIGACION>>>

Ejecuta ahora UNICAMENTE las acciones pendientes de la peticion usando tus herramientas. Por ejemplo: crear el documento con create_word_document usando el contenido de la investigacion, guardarlo en la ruta que pidio el usuario, y abrirlo al terminar (execute_command con: start "" "ruta_del_archivo") salvo que el usuario pida no abrirlo.

Reglas estrictas:
1. NUNCA afirmes que creaste, guardaste o abriste un archivo si la herramienta no devolvio exito en este turno.
2. Si una herramienta falla, informa el error real al usuario.
3. Tu respuesta final debe ser breve: que accion ejecutaste, la ruta real del archivo devuelta por la herramienta y su estado. No repitas el contenido de la investigacion.`;
}
