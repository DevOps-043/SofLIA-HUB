import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { z } from 'zod';
import { trustedAppCaller, nativeConfirmation } from '../ipc/caller-authorization';
import { desktopInputSnapshot, desktopInputs } from '../../src/shared/desktop-input';
import { computerActionReview } from '../computer-use/ipc-review';

export type DesktopCaller = ReturnType<typeof trustedAppCaller>;
type Name = keyof typeof desktopInputs;
export type DesktopOperationContext = DesktopCaller & { retain(until: Promise<unknown>): void };
type Options = { effect?: boolean; raw?: boolean; control?: boolean };
const failed = (error: string) => ({ success: false, error, message: 'No se completó la operación de Desktop Agent. Un efecto ya iniciado puede haberse aplicado.' });

export function desktopRegistration(windows: () => (BrowserWindow | null)[]) {
  const approve = nativeConfirmation('SofLIA — Revisar operación de Desktop Agent');
  const effects = new Set<IpcMainInvokeEvent['sender']>();
  let queries = 0, controls = 0;
  return function register<N extends Name>(name: N, handler: (context: DesktopOperationContext, ...args: z.output<(typeof desktopInputs)[N]>) => unknown | Promise<unknown>, options: Options = {}): void {
    ipcMain.handle(`desktop-agent:${name}`, async (event, ...args: unknown[]) => {
      const caller = trustedAppCaller(event, windows); let admitted = false, retained: Promise<unknown> | undefined;
      let phase = 'IPC_DENIED';
      try {
        caller.assert(); phase = 'INVALID_PAYLOAD';
        const parsed = desktopInputs[name].parse(desktopInputSnapshot(args)) as z.output<(typeof desktopInputs)[N]>;
        phase = 'BUSY';
        if (options.effect ? effects.has(event.sender) || effects.size >= 4 : options.control ? controls >= 8 : queries >= 16) throw new Error('busy');
        if (options.effect) effects.add(event.sender); else if (options.control) controls++; else queries++; admitted = true;
        phase = 'IPC_DENIED';
        if (options.effect && (!caller.parent || !await approve(caller.parent, computerActionReview(`desktop-agent:${name}`, { argumentos: parsed }), caller.assert, caller.signal))) return failed('CANCELLED');
        caller.assert(); phase = 'DESKTOP_FAILED';
        const result = await handler({ ...caller, retain: until => { retained = until; } }, ...parsed);
        caller.assert(); return result;
      } catch {
        if (phase === 'DESKTOP_FAILED') { try { caller.assert(); } catch { phase = 'IPC_DENIED'; } }
        if (options.raw) throw new Error(`Desktop Agent: ${phase}`);
        return failed(phase);
      } finally {
        if (admitted) { if (options.effect) effects.delete(event.sender); else if (options.control) controls--; else queries--; }
        if (retained) void retained.finally(caller.dispose).catch(() => undefined); else caller.dispose();
      }
    });
  };
}
export type DesktopRegister = ReturnType<typeof desktopRegistration>;
