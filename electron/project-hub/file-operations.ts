import type { IpcMainInvokeEvent } from 'electron';

type Kind = 'upload' | 'download';
/** El slot dura hasta cerrar el picker/trabajo, aunque su señal ya esté cancelada. */
export class ProjectFileOperations {
  private active: { kind: Kind; id: string; userId: string; event: IpcMainInvokeEvent; cancellation: AbortController } | null = null;
  start(kind: Kind, id: string, userId: string, event: IpcMainInvokeEvent) {
    if (this.active) return null;
    const operation = { kind, id, userId, event, cancellation: new AbortController() }; this.active = operation;
    return { signal: operation.cancellation.signal, release: () => { if (this.active === operation) this.active = null; } };
  }
  cancel(kind: Kind, id: string, userId: string | null, event: IpcMainInvokeEvent): void {
    const active = this.active;
    if (active?.kind === kind && active.id === id && active.userId === userId && active.event.sender === event.sender
      && active.event.senderFrame === event.senderFrame) active.cancellation.abort();
  }
}
