import type { CapabilitiesDeps, GchatCapabilityResult } from './types';

export async function resolveGchatCapability(
  deps: CapabilitiesDeps,
  hasGoogle: boolean,
): Promise<GchatCapabilityResult> {
  if (!hasGoogle) {
    return {
      gchatSpaces: [],
      capability: {
        key: 'gchat',
        label: 'Google Chat',
        state: 'disconnected',
        message: 'Google Chat no esta disponible porque no hay una cuenta de Google conectada.',
        guidance: 'Conecta Google Workspace primero.',
      },
    };
  }

  const result = await deps.gchatService.listSpaces();
  if (result.success) {
    const gchatSpaces = result.spaces || [];
    return {
      gchatSpaces,
      capability: {
        key: 'gchat',
        label: 'Google Chat',
        state: 'available',
        message: gchatSpaces.length > 0
          ? `${gchatSpaces.length} espacio(s) disponibles para compartir salidas.`
          : 'Google Chat conectado, sin espacios visibles por ahora.',
        guidance: null,
      },
    };
  }

  return createGchatErrorCapability(String(result.error || 'No pude consultar Google Chat.'));
}

function createGchatErrorCapability(message: string): GchatCapabilityResult {
  const setupRequired = /google chat app not found/i.test(message);
  return {
    gchatSpaces: [],
    capability: {
      key: 'gchat',
      label: 'Google Chat',
      state: setupRequired ? 'setup_required' : 'error',
      message,
      guidance: setupRequired
        ? 'Activa la Chat API y configura la app de Google Chat en Google Cloud. Los demas flujos de Google seguiran funcionando sin esta salida.'
        : 'Revisa la configuracion de Google Chat o vuelve a intentarlo.',
    },
  };
}
