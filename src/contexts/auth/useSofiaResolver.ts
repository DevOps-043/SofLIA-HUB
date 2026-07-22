import { useCallback } from 'react';
import { sofiaAuth } from '../../services/sofia-auth';
import { buildSofiaContext } from './helpers';
import type { SofiaContextResolution } from './types';

// `fetchSofiaUserProfile` devuelve null cuando SOFIA no esta disponible o la
// consulta falla (traga el error). Un perfil valido SIN membresias activas si
// devuelve objeto con `memberships: []`. Esa diferencia es la que permite
// distinguir una denegacion real de un fallo transitorio: solo la primera debe
// cerrar la sesion.
const MAX_INTENTOS = 3;
const RETRASO_BASE_MS = 400;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useSofiaResolver() {
  return useCallback(async (sofiaUserId: string): Promise<SofiaContextResolution> => {
    for (let intento = 0; intento < MAX_INTENTOS; intento += 1) {
      const profile = await sofiaAuth.fetchSofiaUserProfile(sofiaUserId);

      if (profile) {
        const nextSofiaContext = buildSofiaContext(profile);
        if (!nextSofiaContext) {
          console.warn('Usuario sin membresias activas en SOFIA.');
          return { status: 'denied' };
        }
        return { status: 'ok', context: nextSofiaContext };
      }

      if (intento < MAX_INTENTOS - 1) {
        await esperar(RETRASO_BASE_MS * 2 ** intento);
      }
    }

    console.warn('Contexto SOFIA no disponible tras reintentos; se conserva la sesion.');
    return { status: 'error', error: new Error('Perfil SOFIA no disponible') };
  }, []);
}
