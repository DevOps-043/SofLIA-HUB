import { supabase } from '../../lib/supabase';

let keyRevision = 0;

/** Invalida lecturas de claves activas sin revocar mutaciones en curso. */
export function invalidateApiKeyReads(): void { keyRevision += 1; }

/** Vigencia local: no implica cancelación de una escritura ya enviada. */
export function observeApiKeySession(trackKeyRevision = false) {
  const controller = new AbortController();
  const started = keyRevision;
  const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
    if (event !== 'INITIAL_SESSION') controller.abort();
  });
  return {
    signal: controller.signal,
    isCurrent: () => !controller.signal.aborted && (!trackKeyRevision || started === keyRevision),
    dispose: () => { controller.abort(); subscription.unsubscribe(); },
  };
}
