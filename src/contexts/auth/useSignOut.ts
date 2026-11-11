import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { sofiaAuth } from '../../services/sofia-auth';
import { clearLiaCredentials } from './lia-credentials';
import type { AuthOperations } from './auth-operations';

type SignOutDeps = {
  usingSofia: boolean;
  operations: AuthOperations;
  setLoading: (value: boolean) => void;
};

export function useSignOut({ usingSofia, operations, setLoading }: SignOutDeps) {
  return useCallback(async () => {
    const intent = operations.begin('sign-out');
    if (!operations.isCurrent(intent.signal)) return;
    clearLiaCredentials();
    setLoading(false);
    if (usingSofia) sofiaAuth.clearLocalProfile();
    try {
      await operations.enqueue(intent.signal, async () => {
        try {
          if (usingSofia) await sofiaAuth.signOut();
          if (!operations.isCurrent(intent.signal)) return;
          await supabase.auth.signOut();
        } catch {
          if (!operations.isCurrent(intent.signal)) return;
          console.warn('[autenticacion] cierre remoto fallido; se descarta la sesion local');
          try { await supabase.auth.signOut({ scope: 'local' }); } catch {
            if (operations.isCurrent(intent.signal)) console.error('[autenticacion] no se pudo descartar la sesion local');
          }
        }
      });
    } finally {
      if (operations.isCurrent(intent.signal)) setLoading(false);
      operations.finish(intent);
    }
  }, [operations, setLoading, usingSofia]);
}
