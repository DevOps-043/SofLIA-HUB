import { ipcMain, type BrowserWindow } from 'electron';
import { trustedAppCaller } from '../ipc/caller-authorization';
import { nativeGeminiAuthority } from '../openai-runtime/credentials';
import type { OpenAIAuthority, OpenAICaller } from '../openai-runtime/types';
import { GEMINI_CONVERSATION_CHANNEL, type NativeGeminiReply } from '../../src/shared/native-gemini-conversation';
import { validateConversationRequest } from './contract';
import { generateGeminiConversation, type GeminiConversationProvider } from './provider';
import { createLogger } from '../utils/logger';
import { withCorrelation } from '../utils/correlation';
import { conversationFailure, GeminiConversationService } from './service';

interface Dependencies {
  bind(caller: OpenAICaller): OpenAIAuthority;
  provider: GeminiConversationProvider;
}
const log = createLogger('ia-conversacion');
const defaults: Dependencies = { bind: nativeGeminiAuthority, provider: generateGeminiConversation };

export function registerGeminiConversation(windows: () => (BrowserWindow | null)[], deps = defaults): void {
  const service = new GeminiConversationService(deps.bind, deps.provider);
  ipcMain.handle(GEMINI_CONVERSATION_CHANNEL, (event, ...args: unknown[]) => withCorrelation(async (): Promise<NativeGeminiReply> => {
    const caller = trustedAppCaller(event, windows);
    let retained = false;
    try {
      caller.assert();
      if (args.length !== 1) return conversationFailure('INVALID_PAYLOAD');
      let request;
      try { request = validateConversationRequest(args[0]); }
      catch { return conversationFailure('INVALID_PAYLOAD'); }
      const owner = { sender: event.sender, frame: event.senderFrame, userId: caller.userId };
      if (request.operation === 'open') {
        const result = service.open(owner, caller, request);
        retained = result.success;
        return result;
      }
      if (request.operation === 'close') return service.close(owner, request.turnId);
      const started = Date.now();
      const result = await service.send(owner, request);
      caller.assert();
      log.debug({ success: result.success, durationMs: Date.now() - started }, 'Llamada de conversación terminada.');
      return result;
    } catch {
      return conversationFailure('REVOKED');
    } finally {
      if (!retained) caller.dispose();
    }
  }));
}
