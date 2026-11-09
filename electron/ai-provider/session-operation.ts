import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { getHubSessionUserId } from '../main/hub-session';

/** Liga preparación, inferencia y uso del resultado a la misma sesión nativa. */
export function captureSessionOperation() {
  const actor = getAuthState();
  const user = getHubSessionUserId();
  const controller = new AbortController();
  const dispose = onAuthStateChange(() => controller.abort());
  const assert = () => {
    if (controller.signal.aborted || !actor.authenticated || !actor.userId || !user
      || !getAuthState().authenticated || getAuthState().userId !== actor.userId || getHubSessionUserId() !== user) {
      throw new Error('La sesión de inferencia cambió o no está disponible.');
    }
  };
  try { assert(); } catch (error) { dispose(); throw error; }
  return { signal: controller.signal, assert, dispose };
}
