import { useContext } from 'react';
import { AuthProvider } from './auth/AuthProvider';
import { AuthContext } from './auth/context';

export { AuthProvider };

export const useAuth = () => {
  return useContext(AuthContext);
};
