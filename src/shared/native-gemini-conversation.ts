import type { JsonObject } from './bounded-json';

export const GEMINI_CONVERSATION_CHANNEL = 'ai:gemini-conversation';
export const GEMINI_CALL_TIMEOUT_MS = 40_000;
export const GEMINI_IDLE_TIMEOUT_MS = 20 * 60_000;
export const GEMINI_MAX_TURNS = 4;
export const GEMINI_MAX_CALLS_PER_TURN = 64;
export const GEMINI_SETUP_BYTES = 2 * 1024 * 1024;
export const GEMINI_HISTORY_BYTES = 96 * 1024 * 1024;
export const GEMINI_REPLY_BYTES = 16 * 1024 * 1024;

export const GEMINI_MEDIA_RESOLUTIONS = ['MEDIA_RESOLUTION_LOW', 'MEDIA_RESOLUTION_MEDIUM', 'MEDIA_RESOLUTION_HIGH'] as const;
export type GeminiMediaResolution = typeof GEMINI_MEDIA_RESOLUTIONS[number];
export interface NativeGeminiSetup {
  model: string;
  config: JsonObject;
  history: JsonObject[];
}
export type NativeGeminiOpen = NativeGeminiSetup & { operation: 'open' };
export interface NativeGeminiSend {
  operation: 'send';
  turnId: string;
  message: string | JsonObject[];
  mediaResolution?: GeminiMediaResolution;
  disableTools?: true;
}
export type NativeGeminiRequest = NativeGeminiOpen | NativeGeminiSend | { operation: 'close'; turnId: string };
export type NativeGeminiFailureCode = 'INVALID_PAYLOAD' | 'REVOKED' | 'BUSY' | 'LIMIT' | 'TIMEOUT' | 'PROVIDER_FAILED';
export type NativeGeminiReply =
  | { success: true; turnId: string }
  | { success: true; response: JsonObject }
  | { success: true; closed: true }
  | { success: false; code: NativeGeminiFailureCode; status?: number };
export interface NativeGeminiConversationApi {
  request(input: NativeGeminiRequest): Promise<NativeGeminiReply>;
}
