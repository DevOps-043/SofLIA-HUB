import { consumeDesktopMemoryEvent } from '../desktop-agent/task-publications';
type MemoryWriter = { saveMessage(params: { sessionKey: string; phoneNumber: string; ownerKey?: string; role: 'user' | 'model'; content: string }): void };
/** Aprender sólo del evento terminal originario, sin inferir usuario al recibirlo. */
export function recordDesktopTaskMemory(memory: MemoryWriter | null, payload: unknown, failed = false): void {
  if (!memory) return;
  const event = consumeDesktopMemoryEvent(payload, failed);
  if (!event?.task) return;
  try {
    const sessionKey = 'desktop:' + event.ownerKey;
    event.assertCurrent();
    memory.saveMessage({ sessionKey, phoneNumber: event.ownerKey, ownerKey: event.ownerKey, role: 'user', content: event.task });
    event.assertCurrent();
    memory.saveMessage({ sessionKey, phoneNumber: event.ownerKey, ownerKey: event.ownerKey, role: 'model', content: '[Tarea de escritorio ' + (failed ? 'FALLIDA' : 'COMPLETADA') + '] ' + (event.message || (failed ? 'sin detalle' : 'ok')) });
  } catch { /* Aprendizaje auxiliar: no reasignar ni reintentar en otra identidad. */ }
}
