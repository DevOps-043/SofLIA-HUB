import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { trustedAppCaller } from './ipc/caller-authorization';
import { groundingRequestId, validateGroundingInput } from '../src/shared/grounded-generation';
import { nativeGeminiAuthority } from './openai-runtime/credentials';
import type { OpenAIAuthority, OpenAICaller } from './openai-runtime/types';
import { AiGroundingService } from './ai-grounding-service';
import { createLogger } from './utils/logger';
import { withCorrelation } from './utils/correlation';

const log = createLogger('ia-investigacion');
export function registerAiGroundingHandler(
  getMainWindow: () => BrowserWindow | null,
  getOrbWindow: () => BrowserWindow | null = () => null,
  bind: (caller: OpenAICaller) => OpenAIAuthority = nativeGeminiAuthority,
): void {
  const windows = () => [getMainWindow(), getOrbWindow()];
  const service = new AiGroundingService();
  ipcMain.handle('ai:generate-grounded', (event: IpcMainInvokeEvent, ...args: unknown[]) => withCorrelation(async () => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    let authority: OpenAIAuthority | undefined;
    let phase = 'authorization'; const started = Date.now();
    try {
      caller = trustedAppCaller(event, windows); caller.assert(); phase = 'validation';
      if (args.length !== 1) throw new Error('Solicitud no válida.');
      const input = validateGroundingInput(args[0]);
      phase = 'execution';
      authority = bind(caller);
      const result = await service.generate(event.sender, input, {
        frame: event.senderFrame,
        user: caller.userId!,
        signal: authority.signal,
        assertCurrent: authority.assert,
        key: authority.key,
      });
      authority.assert();
      log.info({ success: result.success, durationMs: Date.now() - started }, 'Solicitud de investigación terminada.');
      return result;
    } catch {
      log.warn({ durationMs: Date.now() - started }, 'Solicitud de investigación rechazada.');
      if (phase === 'execution' && (authority?.signal.aborted || caller?.signal.aborted)) {
        return { success: false, code: 'CANCELLED', error: 'La sesión de investigación cambió.' };
      }
      return { success: false, code: phase === 'validation' ? 'INVALID_PAYLOAD' : 'IPC_DENIED', error: 'No se pudo autorizar o validar la investigación.' };
    } finally { if (authority) authority.dispose(); else caller?.dispose(); }
  }));
  ipcMain.handle('ai:cancel-grounded', async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    try {
      caller = trustedAppCaller(event, windows); caller.assert();
      if (args.length !== 1) return { success: false };
      return { success: service.cancel(event.sender, groundingRequestId(args[0]), event.senderFrame, caller.userId!) };
    } catch { return { success: false }; }
    finally { caller?.dispose(); }
  });
}
