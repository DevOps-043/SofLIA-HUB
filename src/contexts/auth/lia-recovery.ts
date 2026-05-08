import type { Session } from '@supabase/supabase-js';
import { retrieveLiaCredentials } from './lia-credentials';
import { buildLiaStatusMessage } from './lia-status-message';
import { LIA_RESTORE_MESSAGE } from './helpers';
import type { LiaSessionSyncResult } from './types';

type RecoveryDeps = {
  ensureLiaSession: (email?: string | null, password?: string) => Promise<Session | null>;
  setLiaDegraded: (value: boolean) => void;
  setLiaStatusMessage: (value: string | null) => void;
};

export async function applyLiaRestore(liaRestore: LiaSessionSyncResult, deps: RecoveryDeps): Promise<boolean> {
  if (liaRestore.session) {
    deps.setLiaDegraded(false);
    deps.setLiaStatusMessage(null);
    return true;
  }

  const savedCreds = retrieveLiaCredentials();
  if (savedCreds) {
    const retrySession = await deps.ensureLiaSession(savedCreds.email, savedCreds.password);
    if (retrySession) {
      deps.setLiaDegraded(false);
      deps.setLiaStatusMessage(null);
      return true;
    }
  }

  deps.setLiaDegraded(true);
  deps.setLiaStatusMessage(liaRestore.error ? buildLiaStatusMessage(liaRestore.error) : LIA_RESTORE_MESSAGE);
  return false;
}
