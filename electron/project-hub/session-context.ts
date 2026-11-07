import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { ProjectHubError } from './session-contract';

export interface ProjectHubSessionLease {
  userId: string;
  signal: AbortSignal;
  assert(): void;
  dispose(): void;
}
export interface ProjectHubOperationAuthorization {
  userId: string;
  assertCurrent(): void;
  signal?: AbortSignal;
}

/** Retira la espera del caller; no cancela una renovación compartida del dueño. */
export async function waitForProjectHubLease<T>(operation: Promise<T>, lease: ProjectHubSessionLease): Promise<T> {
  lease.assert();
  let abort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new ProjectHubError('SESSION_CHANGED', 'La operación Project Hub fue cancelada.'));
    lease.signal.addEventListener('abort', abort, { once: true });
    if (lease.signal.aborted) abort();
  });
  try { const result = await Promise.race([operation, aborted]); lease.assert(); return result; }
  finally { lease.signal.removeEventListener('abort', abort); }
}

/** Se suscribe por operación: A/B/A invalida aunque el id vuelva a coincidir. */
export function captureProjectHubIdentity(epochSignal: AbortSignal, assertEpoch: () => void,
  authorization?: ProjectHubOperationAuthorization): ProjectHubSessionLease {
  const original = getAuthState();
  if (!original.authenticated || !original.userId) throw new ProjectHubError('NOT_AUTHENTICATED', 'Project Hub requiere iniciar sesión.');
  const cancellation = new AbortController();
  const unsubscribe = onAuthStateChange(() => cancellation.abort());
  const signal = AbortSignal.any([epochSignal, cancellation.signal, ...(authorization?.signal ? [authorization.signal] : [])]);
  const assert = () => {
    const current = getAuthState();
    if (signal.aborted || !current.authenticated || current.userId !== original.userId) {
      throw new ProjectHubError('SESSION_CHANGED', 'La sesión cambió; vuelve a intentar la operación.');
    }
    assertEpoch();
    if (authorization) {
      if (authorization.userId !== original.userId) throw new ProjectHubError('SESSION_CHANGED', 'El usuario de la operación cambió.');
      try { authorization.assertCurrent(); }
      catch { throw new ProjectHubError('SESSION_CHANGED', 'El contexto de la operación cambió.'); }
    }
  };
  return { userId: original.userId, signal, assert, dispose: () => { unsubscribe(); cancellation.abort(); } };
}
