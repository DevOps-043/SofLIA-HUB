import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { nativeConfirmation, trustedAppCaller } from '../ipc/caller-authorization';
import { getOrganizationContext } from '../main/organization-context';
import { communicationOperation, withCommunicationOperation } from './operation-context';
import { boundedJsonSnapshot } from '../../src/shared/bounded-json';
import { createLogger } from '../utils/logger';
import { COMMUNICATION_IPC_LIMITS as limits, type CommunicationHubActor } from '../../src/shared/communication-hub-ipc';
const log = createLogger('canales-ipc');
const gateways = new WeakMap<object, CommunicationGateway>();
export type CommunicationGateway = ReturnType<typeof createGateway>;
export function communicationGateway(key: object, windows: () => (BrowserWindow | null)[]): CommunicationGateway {
  let gateway = gateways.get(key); if (!gateway) { gateway = createGateway(windows); gateways.set(key, gateway); } return gateway;
}
function createGateway(windows: () => (BrowserWindow | null)[]) {
  const confirm = nativeConfirmation('Autorizar cambio en comunicaciones');
  let active = 0;
  const run = async (channel: string, event: IpcMainInvokeEvent, action: () => Promise<unknown>) => {
      const caller = trustedAppCaller(event, windows), org = getOrganizationContext();
      const deadline = new AbortController(), signal = AbortSignal.any([caller.signal, deadline.signal]);
      const timer = setTimeout(() => deadline.abort(), limits.requestMs); timer.unref?.();
      const started = Date.now(); let success = false;
      const assert = () => { caller.assert(); if (signal.aborted || getOrganizationContext().revision !== org.revision || org.userId !== caller.userId) throw new Error('Contexto organizacional revocado.'); };
      try {
        assert();
        if (active >= limits.activeOperations) return { success: false, error: 'Hay demasiadas operaciones de comunicación pendientes.' };
        const actor = { userId: caller.userId, organizationId: org.organizationId };
        active++;
        try {
          return await withCommunicationOperation({ actor, signal, assert, confirm: detail => confirm(caller.parent!, `Organización: ${org.organizationId || 'personal'}\n${detail}`, assert, signal) }, async () => {
            const result = await action(); assert(); const snapshot = boundedJsonSnapshot(result, limits.outputBytes, { depth: 16 });
            success = snapshot !== null && typeof snapshot === 'object' && !Array.isArray(snapshot) && snapshot.success === true; return snapshot;
          });
        } finally { active--; }
      } catch { return { success: false, error: 'No se pudo autorizar o completar la operación de comunicación.' }; }
      finally { clearTimeout(timer); deadline.abort(); caller.dispose(); log.debug({ channel, durationMs: Date.now() - started, success }, 'Operación IPC de comunicación finalizada.'); }
  };
  const register = (channel: string, count: number, work: (args: unknown[], actor: CommunicationHubActor, event: IpcMainInvokeEvent) => Promise<unknown>) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => run(channel, event, async () => {
      if (args.length > count || count === 2 && args.length !== 2) throw new Error('Solicitud de comunicación no válida.');
      const op = communicationOperation(); if (!op) throw new Error('Contexto de comunicación ausente.');
      return work(args, op.actor, event);
    }));
  };
  return { register, run };
}
