import { GOOGLE_API_KEY, MODELS } from '../../config';
import {
  GEMINI_GROUNDING_API,
  GEMINI_GROUNDING_MODELS,
  GEMINI_GROUNDING_TOOLS,
} from '../../shared/gemini-grounding-config';
import { getApiKeyWithCache } from '../api-keys';
import { extractSources } from './sources';
import { completedStreamResult, isAbortError, stoppedStreamResult } from './streams';
import type { StreamResult, ToolCallInfo } from './types';

const WEB_GROUNDING_FAILURE =
  'No pude verificar informacion actualizada con fuentes externas en este momento. Intenta de nuevo o comparte una URL concreta para analizarla.';

// La búsqueda web va por fetch/IPC crudos: sin límite podían colgarse para
// siempre (p. ej. API bloqueada) y dejar el chat en "..." eterno. Se acota.
const GROUNDING_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Combina la señal de cancelación del usuario (botón Stop) con un timeout, para
 * que ninguna petición de grounding quede colgada indefinidamente.
 */
function createBoundedSignal(userSignal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onUserAbort = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener('abort', onUserAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      userSignal?.removeEventListener('abort', onUserAbort);
    },
  };
}

/** Corre una promesa (p. ej. IPC sin signal) pero la rechaza si se aborta la señal. */
function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

type GroundingApiKeySource = 'user' | 'environment';

interface GroundingApiKeyCandidate {
  source: GroundingApiKeySource;
  value: string;
}

export function shouldUseWebGrounding(message: string): boolean {
  const normalized = normalizeText(message);
  if (hasPublicUrl(message)) return true;
  if (/\b(investiga|investigar|investigacion|busqueda|busca en internet|buscar en internet|googlea|consulta fuentes|fuentes|citas)\b/.test(normalized)) return true;
  if (/\b(actualizado|actualizada|reciente|recientes|ultimas|ultimos|hoy|ayer|esta semana|este mes|noticia|noticias|lanzamiento|release)\b/.test(normalized)) return true;
  if (/\b(precio|cotizacion|ranking|version|versiones|benchmark|comparativa)\b/.test(normalized)) return true;
  return /\b(claude|anthropic|openai|gemini|llama|mistral|modelo de ia|modelos de ia|ai model|llm)\b/.test(normalized);
}

export async function sendGroundedMessage(input: {
  candidateModelIds: string[];
  finalMessage: string;
  messageContent: any;
  systemInstruction: string;
  history: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig: Record<string, any>;
  allToolCalls: ToolCallInfo[];
  allGeneratedImages: string[];
  signal?: AbortSignal;
}): Promise<StreamResult> {
  const apiKeys = await resolveApiKeyCandidates();
  if (!apiKeys.length) return completedStreamResult(WEB_GROUNDING_FAILURE, {}, input.allToolCalls, input.allGeneratedImages);

  let lastError: unknown = null;
  for (const modelId of resolveGroundingModelIds(input.candidateModelIds)) {
    for (const apiKey of apiKeys) {
      if (input.signal?.aborted) return stoppedStreamResult(input.allToolCalls, input.allGeneratedImages);
      try {
        const response = await requestGroundedContent(modelId, apiKey, input);
        const text = extractResponseText(response);
        const sources = extractSources(response);
        if (!text.trim() || !sources?.length) throw new Error('WEB_GROUNDING_NO_VERIFIED_SOURCES');
        return completedStreamResult(text, response, input.allToolCalls, input.allGeneratedImages);
      } catch (error) {
        // Cancelación del usuario: detener limpio, no seguir probando modelos.
        if (isAbortError(error, input.signal)) return stoppedStreamResult(input.allToolCalls, input.allGeneratedImages);
        lastError = error;
        console.warn('[GeminiChat] grounded model attempt failed:', {
          modelId,
          apiKeySource: apiKey.source,
          error: sanitizeGroundingLogError(error),
        });
      }
    }
  }

  console.warn('[GeminiChat] grounded response unavailable:', sanitizeGroundingLogError(lastError));
  return completedStreamResult(WEB_GROUNDING_FAILURE, {}, input.allToolCalls, input.allGeneratedImages);
}

async function resolveApiKeyCandidates(): Promise<GroundingApiKeyCandidate[]> {
  const dbApiKey = await getApiKeyWithCache('google');
  return uniqueApiKeys([
    dbApiKey ? { source: 'user', value: dbApiKey } : null,
    GOOGLE_API_KEY ? { source: 'environment', value: GOOGLE_API_KEY } : null,
  ]);
}

function uniqueApiKeys(candidates: Array<GroundingApiKeyCandidate | null>): GroundingApiKeyCandidate[] {
  const seen = new Set<string>();
  const uniqueCandidates: GroundingApiKeyCandidate[] = [];
  for (const candidate of candidates) {
    const value = candidate?.value.trim();
    if (!candidate || !value || seen.has(value)) continue;
    seen.add(value);
    uniqueCandidates.push({ source: candidate.source, value });
  }
  return uniqueCandidates;
}

async function requestGroundedContent(
  modelId: string,
  apiKey: GroundingApiKeyCandidate,
  input: {
    finalMessage: string;
    messageContent: any;
    systemInstruction: string;
    history: Array<{ role: string; parts: Array<{ text: string }> }>;
    generationConfig: Record<string, any>;
    signal?: AbortSignal;
  },
): Promise<any> {
  const modelName = normalizeModelName(modelId);
  const body = buildGroundingRequestBody(input);
  // Acota la petición con timeout + cancelación del usuario para no colgarse.
  const { signal, cleanup } = createBoundedSignal(input.signal, GROUNDING_REQUEST_TIMEOUT_MS);
  try {
    const mainResponse = await requestGroundedContentViaMain(modelName, apiKey.value, body, signal);
    if (mainResponse) return mainResponse;

    const response = await fetch(`${GEMINI_GROUNDING_API.generateContentBaseUrl}/${modelName}:generateContent?key=${encodeURIComponent(apiKey.value)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    const raw = await response.text();
    const payload = parseJsonResponse(raw);
    if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    return payload;
  } finally {
    cleanup();
  }
}

async function requestGroundedContentViaMain(modelName: string, apiKey: string, body: Record<string, any>, signal: AbortSignal): Promise<any | null> {
  const ipc = getIpcRenderer();
  if (!ipc?.invoke) return null;

  try {
    // El IPC no acepta signal: se acota con raceWithSignal (timeout + Stop).
    const result = await raceWithSignal(ipc.invoke('ai:generate-grounded', { modelName, apiKey, body }), signal);
    if (result?.success) return result.payload || {};
    if (!result || typeof result !== 'object') return null;
    throw new Error(result?.error || `HTTP ${result?.status || 'unknown'}`);
  } catch (error) {
    if (isMissingIpcGroundingHandler(error)) return null;
    throw error;
  }
}

function getIpcRenderer(): { invoke?: (channel: string, ...args: any[]) => Promise<any> } | null {
  if (typeof window === 'undefined') return null;
  return (window as any).ipcRenderer || null;
}

function isMissingIpcGroundingHandler(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Unauthorized IPC channel|No handler registered|No handler|Cannot read|is not a function/i.test(message);
}

function buildGroundingRequestBody(input: {
  finalMessage: string;
  messageContent: any;
  systemInstruction: string;
  history: Array<{ role: string; parts: Array<{ text: string }> }>;
  generationConfig: Record<string, any>;
}): Record<string, any> {
  return {
    contents: [
      ...input.history,
      { role: 'user', parts: toRestParts(input.messageContent || input.finalMessage) },
    ],
    systemInstruction: {
      parts: [{ text: buildGroundingInstruction(input.systemInstruction) }],
    },
    generationConfig: input.generationConfig,
    tools: buildGroundingTools(input.finalMessage),
  };
}

function parseJsonResponse(raw: string): any {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function normalizeModelName(modelId: string): string {
  return modelId.replace(/^models\//, '').trim();
}

function resolveGroundingModelIds(candidateModelIds: string[]): string[] {
  return uniqueModelIds([
    MODELS.WEB_AGENT,
    ...candidateModelIds,
    MODELS.FALLBACK,
    MODELS.PRO,
    ...GEMINI_GROUNDING_MODELS.preferredFallbacks,
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

function buildGroundingTools(message: string): Array<Record<string, Record<string, never>>> {
  const tools: Array<Record<string, Record<string, never>>> = [{ [GEMINI_GROUNDING_TOOLS.googleSearch]: {} }];
  if (extractPublicUrls(message).length > 0) tools.push({ [GEMINI_GROUNDING_TOOLS.urlContext]: {} });
  return tools;
}

function toRestParts(content: any): any[] {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content || '') }];
  return content.map((part) => (typeof part === 'string' ? { text: part } : part));
}

function extractResponseText(response: any): string {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.filter((part: any) => part.text).map((part: any) => part.text).join('');
}

function buildGroundingInstruction(systemInstruction: string): string {
  return `${systemInstruction}

=== INVESTIGACION WEB OBLIGATORIA ===
Usa Google Search y URL Context para consultas de investigacion, noticias, productos, modelos de IA, datos recientes, precios, versiones o URLs.
No afirmes que consultaste informacion actualizada si no puedes respaldarla con fuentes recuperadas.
Prioriza fuentes oficiales y recientes. Si hay incertidumbre, dilo con claridad.
Responde en espanol y conserva un tono profesional.`;
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasPublicUrl(text: string): boolean {
  return extractPublicUrls(text).length > 0;
}

function extractPublicUrls(text: string): string[] {
  return (text.match(/https?:\/\/[^\s)]+/gi) || [])
    .map((url) => url.replace(/[.,;:!?]+$/, ''))
    .filter(Boolean);
}

function sanitizeGroundingLogError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'unknown');
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[api-key]')
    .replace(/key=[^&\s]+/g, 'key=[api-key]')
    .slice(0, 500);
}
