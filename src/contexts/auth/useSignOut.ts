import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { sofiaAuth } from '../../services/sofia-auth';
import { clearLiaCredentials } from './lia-credentials';

export function useSignOut(usingSofia: boolean, clearSessionState: () => void) {
  return useCallback(async () => {
    try {
      if (usingSofia) await sofiaAuth.signOut();
      await supabase.auth.signOut();
    } finally {
      clearLiaCredentials();
      clearSessionState();
    }
  }, [clearSessionState, usingSofia]);
}
