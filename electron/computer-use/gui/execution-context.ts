import { getAuthState, onAuthStateChange } from '../../main/auth-state';

export interface ComputerExecutionGuard { signal?: AbortSignal; assertCurrent?: () => void }
export type GuiFailureCode = 'GUI_INVALID_INPUT' | 'GUI_CANCELLED' | 'GUI_BUSY' | 'GUI_TIMEOUT' | 'GUI_OUTPUT_LIMIT' | 'GUI_UNAVAILABLE' | 'GUI_FAILED' | 'GUI_TARGET_NOT_FOUND' | 'GUI_AMBIGUOUS_TARGET';
export class GuiFailure extends Error {
  constructor(readonly code: GuiFailureCode) { super('No se completó la operación de escritorio.'); }
}
export function assertGuiExecution(guard?: ComputerExecutionGuard): void {
  if (guard?.signal?.aborted) throw new GuiFailure('GUI_CANCELLED');
  try { guard?.assertCurrent?.(); } catch { throw new GuiFailure('GUI_CANCELLED'); }
}
export const GUI_OPERATION_MS = 60000;
/** La identidad runtime procede de main; nunca de argumentos del modelo. */
export function captureGuiLease(external?: ComputerExecutionGuard) {
  const initial = getAuthState(), controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => { expired = true; controller.abort(); }, GUI_OPERATION_MS);
  const unsubscribe = onAuthStateChange(() => controller.abort());
  const signal = external?.signal ? AbortSignal.any([controller.signal, external.signal]) : controller.signal;
  const assertCurrent = () => {
    if (expired) throw new GuiFailure('GUI_TIMEOUT');
    assertGuiExecution(external);
    const now = getAuthState();
    if (signal.aborted || !initial.authenticated || !initial.userId || !now.authenticated || now.userId !== initial.userId) throw new GuiFailure('GUI_CANCELLED');
  };
  return { signal, assertCurrent, dispose: () => { clearTimeout(timer); controller.abort(); unsubscribe(); } };
}
