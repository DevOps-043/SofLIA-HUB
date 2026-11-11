import { observeApiKeySession } from '../api-keys/session-scope';

/** Rechaza continuaciones y resultados que pertenecen a otra sesión. */
export function observeFlowSession() {
  const scope = observeApiKeySession(true);
  return {
    assert() { if (!scope.isCurrent()) throw new Error('La sesión cambió. Intenta de nuevo.'); },
    dispose: scope.dispose,
  };
}
export type FlowSession = ReturnType<typeof observeFlowSession>;
