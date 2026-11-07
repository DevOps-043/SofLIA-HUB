import { boundedJsonSnapshot, type JsonValue, type JsonObject } from './bounded-json';
export type { JsonValue, JsonObject } from './bounded-json';
import { GEMINI_GROUNDING_API, supportsCodeExecutionCombo } from './gemini-grounding-config';

export const GROUNDED_REQUEST_MS = 150_000;
export const GROUNDED_RESPONSE_BYTES = 8 * 1024 * 1024;
export interface GroundedGenerateInput { requestId?: string; modelName: string; body: JsonObject }
export type GroundedFailureCode = 'INVALID_PAYLOAD' | 'IPC_DENIED' | 'CANCELLED' | 'BUSY' | 'CREDENTIAL_FAILED' | 'PROVIDER_FAILED';
export type GroundedGenerateReply = { success: true; payload: JsonObject } | { success: false; code: GroundedFailureCode; error: string; status?: number };
export interface GroundedGenerationApi {
  generate(input: GroundedGenerateInput): Promise<GroundedGenerateReply>;
  cancel(requestId: string): Promise<{ success: boolean }>;
}
export function jsonObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function groundingRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error('Solicitud de investigación no válida.');
  return value;
}
/** Snapshot JSON sin getters/prototipos, antes de serializar o aceptar herramientas. */
export function groundingSnapshot(value: unknown, maxBytes = GEMINI_GROUNDING_API.maxRequestBytes): JsonValue { return boundedJsonSnapshot(value, maxBytes); }
export function validateGroundingInput(value: unknown): GroundedGenerateInput {
  const input = groundingSnapshot(value);
  if (!jsonObject(input) || Object.keys(input).some(key => !['requestId', 'modelName', 'body'].includes(key))) throw new Error('Solicitud de investigación no válida.');
  if (typeof input.modelName !== 'string' || !jsonObject(input.body)) throw new Error('Solicitud de investigación no válida.');
  const modelName = input.modelName.replace(/^models\//, '').trim();
  if (!modelName || modelName.length > 128 || !GEMINI_GROUNDING_API.modelNamePattern.test(modelName)) throw new Error('Solicitud de investigación no válida.');
  const body = input.body;
  if (Object.keys(body).some(key => !['contents', 'systemInstruction', 'generationConfig', 'tools'].includes(key)) || !Array.isArray(body.contents) || !body.contents.length || !Array.isArray(body.tools) || !body.tools.length || body.tools.length > 3) throw new Error('Solicitud de investigación no válida.');
  const seen = new Set<string>();
  for (const tool of body.tools) {
    if (!jsonObject(tool)) throw new Error('Herramienta de investigación no válida.');
    const keys = Object.keys(tool), key = keys[0];
    if (keys.length !== 1 || !['google_search', 'url_context', ...(supportsCodeExecutionCombo(modelName) ? ['code_execution'] : [])].includes(key)
      || !jsonObject(tool[key]) || Object.keys(tool[key]).length || seen.has(key)) throw new Error('Herramienta de investigación no válida.');
    seen.add(key);
  }
  return { modelName, body: body as JsonObject, ...(input.requestId === undefined ? {} : { requestId: groundingRequestId(input.requestId) }) };
}
