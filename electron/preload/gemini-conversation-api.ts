import { GEMINI_CONVERSATION_CHANNEL, type NativeGeminiConversationApi } from '../../src/shared/native-gemini-conversation';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeGeminiConversation(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: NativeGeminiConversationApi = { request: input => ipc.safeInvoke(GEMINI_CONVERSATION_CHANNEL, input) };
  bridge.exposeInMainWorld('geminiConversation', api);
}
