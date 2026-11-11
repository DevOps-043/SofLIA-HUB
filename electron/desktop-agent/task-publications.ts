import { AsyncLocalStorage } from 'node:async_hooks';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { userOwnerKey } from '../memory/scope';

interface TaskPublicationLease { service: object; userId: string; task: string; signal: AbortSignal; active: boolean; assert(): void }
const context = new AsyncLocalStorage<TaskPublicationLease>();
interface MemoryEvent { lease: TaskPublicationLease; task: string; message: string; failed: boolean; consumed: boolean }
const provenance = new WeakMap<object, MemoryEvent>();
const rejected = () => new Error('La publicación de la tarea de escritorio ya no está autorizada.');

/** La lease se captura al entrar en main; nunca desde opciones serializadas. */
export async function withDesktopTaskPublication<T>(service: object, task: string, signal: AbortSignal | undefined, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const parent = context.getStore();
  if (parent) {
    if (parent.service !== service) throw rejected();
    parent.assert(); const result = await work(parent.signal); parent.assert(); return result;
  }
  const identity = getAuthState(), controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const lease: TaskPublicationLease = { service, userId: identity.userId ?? '', task, signal: combined, active: true, assert: () => {
    const now = getAuthState();
    if (!lease.active || combined.aborted || !identity.authenticated || !lease.userId || !now.authenticated || now.userId !== lease.userId) throw rejected();
  } };
  const unsubscribe = onAuthStateChange(() => controller.abort());
  try {
    lease.assert();
    return await context.run(lease, async () => { const result = await work(combined); lease.assert(); return result; });
  } finally { lease.active = false; controller.abort(); unsubscribe(); }
}

/** Captura explícita para continuaciones que una cola despacha desde otra tarea. */
export function bindDesktopTaskPublication<A extends unknown[], R>(service: object, work: (...args: A) => R): (...args: A) => R {
  const lease = context.getStore();
  return (...args) => {
    if (!lease || lease.service !== service) throw rejected();
    lease.assert(); return context.run(lease, () => work(...args));
  };
}
export function canPublishDesktopTask(service: object): boolean {
  const lease = context.getStore(); if (!lease || lease.service !== service) return false;
  try { lease.assert(); return true; } catch { return false; }
}
const isTaskEvent = (name: string | symbol) => typeof name === 'string' && (/^task-/.test(name) || /^(step(?:-result)?|plan-created|plan-updated|strategic-plan-created|stuck-detected|consecutive-failures|recovery-started|recovery-strategy)$/.test(name));
function copyPayload(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const descriptors = Object.getOwnPropertyDescriptors(value), output: Record<string, unknown> = {};
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > 256) throw rejected();
  for (const key of keys) {
    if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) || !('value' in descriptors[key])) throw rejected();
    output[key] = descriptors[key].value;
  }
  return output;
}

/** Sin campos de autoridad añadidos al DTO. Sólo la copia emitida tiene procedencia. */
export function desktopTaskPublication(service: object, name: string | symbol, args: unknown[]): unknown[] | null {
  const lease = context.getStore();
  // El control autorizado puede avisar su cancelación sin iniciar otra tarea.
  // Su DTO sólo lleva taskId y jamás concede procedencia para aprendizaje.
  if (name === 'task-aborted' && !lease) {
    const user = getAuthState();
    try {
      const payload = copyPayload(args[0]);
      if (!user.authenticated || !user.userId || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      const fields = payload as Record<string, unknown>;
      return Object.keys(fields).length === 1 && typeof fields.taskId === 'string' && fields.taskId.length <= 256 ? [payload] : null;
    } catch { return null; }
  }
  if (!isTaskEvent(name)) return lease?.service === service && !canPublishDesktopTask(service) ? null : args;
  if (!lease || !canPublishDesktopTask(service)) return null;
  try {
    const payload = copyPayload(args[0]);
    if ((name === 'task-completed' || name === 'task-failed') && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      const task = typeof record.task === 'string' ? record.task : lease.task;
      const message = typeof record.message === 'string' ? record.message : '';
      if (task.length <= 50000 && message.length <= 100000) provenance.set(payload, { lease, task, message, failed: name === 'task-failed', consumed: false });
    }
    return [payload, ...args.slice(1)];
  } catch { return null; }
}
/** La procedencia sólo vive en main y caduca con la operación originaria. */
export function consumeDesktopMemoryEvent(payload: unknown, failed: boolean) {
  if (!payload || typeof payload !== 'object') return null;
  const entry = provenance.get(payload);
  if (!entry || entry.failed !== failed || entry.consumed) return null;
  try { entry.lease.assert(); } catch { return null; }
  entry.consumed = true;
  return { task: entry.task.trim(), message: entry.message.trim(), ownerKey: userOwnerKey(entry.lease.userId), assertCurrent: entry.lease.assert };
}
