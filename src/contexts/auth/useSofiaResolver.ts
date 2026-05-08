import { useCallback } from 'react';
import { sofiaAuth, type SofiaContext } from '../../services/sofia-auth';
import { buildSofiaContext } from './helpers';

export function useSofiaResolver() {
  return useCallback(async (sofiaUserId: string): Promise<SofiaContext | null> => {
    const profile = await sofiaAuth.fetchSofiaUserProfile(sofiaUserId);
    const nextSofiaContext = buildSofiaContext(profile);
    if (!nextSofiaContext) {
      console.warn('Usuario sin membresias activas en SOFIA.');
      return null;
    }
    return nextSofiaContext;
  }, []);
}
