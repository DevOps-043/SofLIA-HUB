import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { sofiaAuth } from '../../services/sofia-auth';
import { clearLiaCredentials } from './lia-credentials';

export function useSignOut(usingSofia: boolean, clearSessionState: () => void) {
  return useCallback(async () => {
    try {
      if (usingSofia) await sofiaAuth.signOut();
      await supabase.auth.signOut();
    } catch (error) {
      // Un cierre de sesion remoto fallido (sin red, token ya vencido) no puede
      // dejar la sesion persistida en el equipo: el siguiente usuario la
      // restauraria y sus datos se escribirian bajo la identidad anterior.
      console.warn('[Auth] Cierre de sesion remoto fallido; se descarta la sesion local:', error);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (localError) {
        console.error('[Auth] No se pudo descartar la sesion local de Supabase:', localError);
      }
    } finally {
      clearLiaCredentials();
      clearSessionState();
    }
  }, [clearSessionState, usingSofia]);
}
