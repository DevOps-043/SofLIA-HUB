import type { ReactNode } from 'react';
import { AuthContext } from './context';
import { useAuthProviderModel } from './useAuthProviderModel';

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthProviderModel();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
