import type { Session } from '@supabase/supabase-js';
import type { SofiaAuthResult, SofiaAuthUser, SofiaContext } from '../../services/sofia-auth';

export type AuthUser = SofiaAuthUser | null;

export type LiaSessionSyncResult = {
  session: Session | null;
  retryAllowed: boolean;
  error?: unknown;
};

// Resultado de resolver el contexto SOFIA (organizacion/equipos):
// - ok: contexto valido con al menos una membresia activa.
// - denied: perfil valido SIN membresia activa -> denegacion real (cerrar sesion).
// - error: SOFIA no disponible o fallo transitorio -> conservar la sesion y degradar.
export type SofiaContextResolution =
  | { status: 'ok'; context: SofiaContext }
  | { status: 'denied' }
  | { status: 'error'; error: unknown };

export interface AuthContextType {
  session: Session | null;
  user: AuthUser;
  dataUserId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  usingSofia: boolean;
  sofiaContext: SofiaContext | null;
  liaDegraded: boolean;
  liaStatusMessage: string | null;
  retryConversations: () => Promise<boolean>;
  signInWithSofia: (email: string, password: string) => Promise<SofiaAuthResult>;
  /** Inicio federado con SofLIA Learning; false cuando el interruptor esta apagado. */
  learningSsoAvailable: boolean;
  signInWithLearningSso: () => Promise<void>;
  cancelLearningSso: () => void;
  ssoPending: boolean;
  ssoError: string | null;
  setCurrentOrganization: (orgId: string) => void;
  setCurrentTeam: (teamId: string) => void;
}
