export const FLOW_MAX_MEDIA_BASE64 = 16 * 1024 * 1024;
export const FLOW_MAX_AUDIO_BYTES = 12 * 1024 * 1024;
export type NativeFlowRequest =
  | { kind: 'analysis' | 'fallback'; text: string; image?: string }
  | { kind: 'transcription'; audio: string; mimeType: string };
export type NativeFlowReply = { success: true; text: string } | { success: false; error: string; code?: 'revoked' };
export interface NativeFlowApi { generate(request: NativeFlowRequest): Promise<NativeFlowReply> }
