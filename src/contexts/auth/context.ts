import { createContext } from 'react';
import type { AuthContextType } from './types';

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  dataUserId: null,
  loading: true,
  signOut: async () => {},
  usingSofia: false,
  sofiaContext: null,
  liaDegraded: false,
  liaStatusMessage: null,
  signInWithSofia: async () => ({ success: false, user: null, session: null, error: 'Not initialized' }),
  setCurrentOrganization: () => {},
  setCurrentTeam: () => {},
});
