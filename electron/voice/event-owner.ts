import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { trustedAppCaller } from '../ipc/caller-authorization';

type Context = ReturnType<typeof trustedAppCaller>;
/** Un consumidor por flujo; su navegación o cambio de sesión retira la entrega. */
export class VoiceEventOwner {
  private binding: { id: string; caller: Context; invalidated: () => void } | null = null;
  constructor(private readonly windows: () => (BrowserWindow | null)[], private readonly visible = false,
    private readonly onInvalidated: (id: string) => void = () => {}) {}
  bind(event: IpcMainInvokeEvent, id: string): void {
    this.clear();
    const caller = trustedAppCaller(event, this.windows);
    try { caller.assert(); } catch (error) { caller.dispose(); throw error; }
    const invalidated = () => { if (this.binding?.caller === caller) { this.clear(); this.onInvalidated(id); } };
    this.binding = { id, caller, invalidated }; caller.signal.addEventListener('abort', invalidated, { once: true });
  }
  owns(event: IpcMainInvokeEvent, id?: string | null): boolean {
    const item = this.binding;
    if (!item || id && item.id !== id || item.caller.parent?.webContents !== event.sender) return false;
    try { item.caller.assert(); return true; } catch { return false; }
  }
  ownedId(event: IpcMainInvokeEvent, id?: string | null): string | undefined { return this.owns(event, id) ? this.binding?.id : undefined; }
  send(channel: string, id: string, payload: unknown): void {
    const item = this.binding; if (!item || item.id !== id) return;
    try { item.caller.assert(); if (this.visible && !item.caller.parent?.isVisible()) return; item.caller.parent!.webContents.send(channel, payload); }
    catch { this.clear(); this.onInvalidated(id); }
  }
  clear(): void {
    const item = this.binding; this.binding = null;
    if (item) { item.caller.signal.removeEventListener('abort', item.invalidated); item.caller.dispose(); }
  }
  clearId(id: string | undefined): void { if (id && this.binding?.id === id) this.clear(); }
  replace(): void {
    const id = this.binding?.id;
    if (id) this.send('orb:tts-end', id, { speechId: id, interrupted: true });
    this.clear();
  }
}
