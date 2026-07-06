import { getCurrentOwnerKey } from './owner-context';

/**
 * Registra el resultado de una tarea del agente de escritorio en la memoria del
 * usuario ACTIVO, para que SofLIA aprenda de sus tareas (procedimientos,
 * preferencias) igual que del chat y WhatsApp. No bloqueante y tolerante a
 * payloads incompletos (otros backends emiten el evento sin `task`).
 */

type DesktopTaskEventPayload = { task?: string; message?: string } | undefined;

type MemoryWriter = {
  saveMessage: (params: { sessionKey: string; phoneNumber: string; ownerKey?: string; role: 'user' | 'model'; content: string }) => void;
};

export function recordDesktopTaskMemory(memory: MemoryWriter | null, payload: DesktopTaskEventPayload, failed = false): void {
  const task = String(payload?.task ?? '').trim();
  const outcome = String(payload?.message ?? '').trim();
  if (!memory || !task) return;
  try {
    const ownerKey = getCurrentOwnerKey();
    const sessionKey = `desktop:${ownerKey}`;
    memory.saveMessage({ sessionKey, phoneNumber: ownerKey, ownerKey, role: 'user', content: task });
    memory.saveMessage({
      sessionKey, phoneNumber: ownerKey, ownerKey, role: 'model',
      content: `[Tarea de escritorio ${failed ? 'FALLIDA' : 'COMPLETADA'}] ${outcome || (failed ? 'sin detalle' : 'ok')}`,
    });
  } catch {
    // no bloqueante
  }
}
