import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { trustedAppCaller } from '../ipc/caller-authorization';
import { getOrganizationContext } from '../main/organization-context';
import { boundedJsonSnapshot, type JsonValue } from '../../src/shared/bounded-json';
import { COMMUNICATION_IPC_LIMITS } from '../../src/shared/communication-hub-ipc';
import type { CommunicationGateway } from './ipc-gateway';

type Channel = 'whatsapp:qr' | 'whatsapp:status';
type Item = { seq: number; payload: JsonValue };
type Viewer = { event: IpcMainInvokeEvent; caller: ReturnType<typeof trustedAppCaller>; orgRevision: number; pending: Map<Channel, Item>; latest: Map<Channel, number>; processing: boolean; seq: number; closed: boolean; remove(): void; assert(): void };
export function publicWhatsAppStatus(raw: unknown): Record<string, JsonValue> {
  const value = boundedJsonSnapshot(raw, COMMUNICATION_IPC_LIMITS.outputBytes, { depth: 16 });
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Estado WhatsApp no válido.');
  const fields = ['connected', 'phoneNumber', 'qr', 'allowedNumbers', 'whitelistEnabled', 'masterNumber', 'masterPermissions', 'contactPermissions', 'groupPolicy', 'groupActivation', 'groupPrefix', 'allowedGroups', 'groupAllowFrom', 'globalPersonalization', 'contactPersonalizations', 'groupPersonalizations'];
  return { success: true, ...Object.fromEntries(Object.entries(value).filter(([key]) => fields.includes(key))) };
}

/** Un receptor por superficie; a lo sumo el último QR y estado pendientes por receptor. */
export class WhatsAppEventViewers {
  private readonly viewers = new Map<object, Viewer>();
  constructor(private readonly gateway: CommunicationGateway, private readonly authorize: () => Promise<void>, private readonly windows: () => (BrowserWindow | null)[]) {}
  enroll(event: IpcMainInvokeEvent): void {
    this.viewers.get(event.sender)?.remove();
    if (this.viewers.size >= 4) throw new Error('Demasiadas vistas de WhatsApp.');
    const caller = trustedAppCaller(event, this.windows), orgRevision = getOrganizationContext().revision;
    const viewer: Viewer = { event, caller, orgRevision, pending: new Map(), latest: new Map(), seq: 0, processing: false, closed: false,
      assert: () => { caller.assert(); if (viewer.closed || getOrganizationContext().revision !== orgRevision || this.viewers.get(event.sender) !== viewer) throw new Error('Vista WhatsApp revocada.'); },
      remove: () => { if (viewer.closed) return; viewer.closed = true; viewer.pending.clear(); caller.signal.removeEventListener('abort', viewer.remove); if (this.viewers.get(event.sender) === viewer) this.viewers.delete(event.sender); caller.dispose(); },
    };
    this.viewers.set(event.sender, viewer); caller.signal.addEventListener('abort', viewer.remove, { once: true });
    try { viewer.assert(); } catch (error) { viewer.remove(); throw error; }
  }
  publish(channel: Channel, raw: unknown): void {
    let payload: JsonValue;
    try { payload = channel === 'whatsapp:status' ? publicWhatsAppStatus(raw) : boundedJsonSnapshot(raw, COMMUNICATION_IPC_LIMITS.outputBytes); if (channel === 'whatsapp:qr' && typeof payload !== 'string') return; } catch { return; }
    for (const viewer of this.viewers.values()) {
      try { viewer.assert(); } catch { viewer.remove(); continue; }
      const item = { seq: ++viewer.seq, payload }; viewer.latest.set(channel, item.seq); viewer.pending.set(channel, item);
      if (!viewer.processing) { viewer.processing = true; void this.drain(viewer); }
    }
  }
  private async drain(viewer: Viewer): Promise<void> {
    try {
      while (!viewer.closed && viewer.pending.size) {
        const [channel, item] = viewer.pending.entries().next().value!; viewer.pending.delete(channel);
        const result = await this.gateway.run(channel, viewer.event, async () => {
          viewer.assert(); await this.authorize(); viewer.assert();
          if (viewer.latest.get(channel) === item.seq) viewer.event.sender.send(channel, item.payload);
          return { success: true };
        });
        if (!result || typeof result !== 'object' || Array.isArray(result) || result.success !== true) viewer.remove();
      }
    } catch { viewer.remove(); }
    finally { viewer.processing = false; }
  }
}
