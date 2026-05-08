import { getSofiaUserByEmail } from '../iris-data-main';
import { baseGoogleCapabilities } from './capabilities/google-capabilities';
import { resolveGchatCapability } from './capabilities/gchat-capability';
import type { CapabilitiesDeps, WorkspaceCapabilitiesSnapshot } from './capabilities/types';

export async function getWorkspaceCapabilitiesSnapshot(
  deps: CapabilitiesDeps,
): Promise<WorkspaceCapabilitiesSnapshot> {
  const googleConnection = deps.calendarService
    .getConnections()
    .find((connection) => connection.provider === 'google' && connection.isActive && connection.email);
  const hasGoogle = Boolean(googleConnection?.email);
  const capabilities = baseGoogleCapabilities(hasGoogle, googleConnection?.email);
  const gchat = await resolveGchatCapability(deps, hasGoogle);
  capabilities.push(gchat.capability);

  if (!googleConnection?.email) {
    capabilities.push({
      key: 'google_user_mapping',
      label: 'Resolucion Google -> SOFIA',
      state: 'disconnected',
      message: 'Sin cuenta de Google conectada no puedo mapear el correo al usuario interno.',
      guidance: 'Conecta Google para habilitar la deteccion pasiva de reuniones desde Calendar/Gmail/Drive. Los triggers de extension via soflia://meeting-trigger pueden seguir funcionando por separado.',
    });
    return { capabilities, gchatSpaces: gchat.gchatSpaces };
  }

  const sofiaUser = googleConnection.userId
    ? { id: googleConnection.userId }
    : await getSofiaUserByEmail(googleConnection.email);
  capabilities.push({
    key: 'google_user_mapping',
    label: 'Resolucion Google -> SOFIA',
    state: sofiaUser?.id ? 'available' : 'blocked',
    message: sofiaUser?.id ? `El correo ${googleConnection.email} si resuelve a un usuario de SOFIA.` : `No encontre un usuario SOFIA para ${googleConnection.email}.`,
    guidance: sofiaUser?.id ? null : 'La deteccion pasiva de reuniones desde Google quedara bloqueada hasta resolver ese mapeo. Los triggers de extension via soflia://meeting-trigger siguen siendo una ruta alternativa.',
  });
  return { capabilities, gchatSpaces: gchat.gchatSpaces };
}
