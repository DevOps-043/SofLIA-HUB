import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { executeToolDirect } from './tool-dispatch';
import { computerInputSnapshot, computerInputs } from '../../src/shared/computer-use-input';
import { trustedAppCaller, nativeConfirmation } from '../ipc/caller-authorization';
import { COMPUTER_IPC_TOOLS } from './ipc-tools';
import { computerActionReview } from './ipc-review';

const denied = () => ({ success: false, error: 'IPC_DENIED', message: 'La sesión o ventana de origen ya no está autorizada. Una operación ya iniciada puede haber producido efectos.' });
const invalid = () => ({ success: false, error: 'INVALID_PAYLOAD', message: 'Argumentos de Computer Use no válidos.' });

export function registerComputerUseHandlers(
  getMainWindow: () => BrowserWindow | null = () => null,
  getOrbWindow: () => BrowserWindow | null = () => null,
): void {
  const windows = () => [getMainWindow(), getOrbWindow()];
  const approve = nativeConfirmation('SofLIA — Revisar acción en el equipo');
  const jobs = new Set<IpcMainInvokeEvent['sender']>();
  type Caller = ReturnType<typeof trustedAppCaller>;
  async function run(event: IpcMainInvokeEvent, action: (caller: Caller) => Promise<Record<string, unknown>>) {
    const caller = trustedAppCaller(event, windows);
    let admitted = false;
    try {
      caller.assert();
      if (jobs.has(event.sender) || jobs.size >= 4) return { success: false, error: 'BUSY', message: 'Computer Use sigue terminando una operación.' };
      jobs.add(event.sender); admitted = true;
      return await action(caller);
    } catch { return denied(); }
    finally { if (admitted) jobs.delete(event.sender); caller.dispose(); }
  }
  for (const mapping of COMPUTER_IPC_TOOLS) {
    ipcMain.handle(mapping.channel, (event, ...params: unknown[]) => run(event, async caller => {
      let args: Record<string, unknown>;
      try { args = mapping.parse(computerInputSnapshot(params)); } catch { return invalid(); }
      if (mapping.review(args)) {
        if (!caller.parent || !await approve(caller.parent, computerActionReview(mapping.tool, args), caller.assert, caller.signal)) {
          return { success: false, error: 'CANCELLED', message: 'Acción cancelada.' };
        }
      }
      caller.assert();
      try {
        const progress = (message: string) => {
          try {
            caller.assert();
            if (typeof message === 'string' && message.length <= 8000) event.sender.send('computer:progress', { tool: mapping.tool, message });
          } catch { /* Fuente revocada: no publicar progreso. */ }
        };
        const result: unknown = mapping.tool === 'use_computer'
          ? await executeToolDirect(mapping.tool, args, progress, { assertCurrent: caller.assert, signal: caller.signal })
          : await executeToolDirect(mapping.tool, args, progress);
        caller.assert();
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid_result');
        const reply = result as Record<string, unknown>;
        if (reply.success === false || reply.ok === false) return { success: false, error: 'TOOL_FAILED', message: 'La operación de Computer Use no pudo completarse.', mayHaveApplied: mapping.review(args) };
        return reply;
      } catch {
        caller.assert();
        return { success: false, error: 'TOOL_FAILED', message: 'La operación de Computer Use no pudo completarse.', mayHaveApplied: mapping.review(args) };
      }
    }));
  }
  // Compatibilidad informativa. Esta respuesta no autoriza otra invocación IPC.
  ipcMain.handle('computer:confirm-action', async (event, ...params: unknown[]) => {
    const result = await run(event, async caller => {
      let message: string;
      try { [message] = computerInputs['confirm-action'].parse(computerInputSnapshot(params)); } catch { return { confirmed: false }; }
      if (!caller.parent) return { confirmed: false };
      return { confirmed: await approve(caller.parent, message, caller.assert, caller.signal), always: false };
    });
    return 'confirmed' in result ? result : { confirmed: false };
  });
}
