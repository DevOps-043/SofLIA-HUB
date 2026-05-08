import type { WorkspaceCapabilityStatus } from '../types';

export function baseGoogleCapabilities(hasGoogle: boolean, email?: string): WorkspaceCapabilityStatus[] {
  return [
    {
      key: 'calendar',
      label: 'Calendar',
      state: hasGoogle ? 'available' : 'disconnected',
      message: hasGoogle ? `Cuenta conectada: ${email}` : 'Conecta Google Calendar para usar agenda y preparacion de reuniones.',
      guidance: hasGoogle ? null : 'Ve a Calendario y vincula tu cuenta de Google.',
    },
    {
      key: 'gmail',
      label: 'Gmail',
      state: hasGoogle ? 'available' : 'disconnected',
      message: hasGoogle ? 'Gmail disponible desde la misma sesion de Google.' : 'Gmail requiere la misma conexion de Google Workspace.',
      guidance: hasGoogle ? null : 'Conecta Google para habilitar correo y seguimiento.',
    },
    {
      key: 'drive',
      label: 'Drive',
      state: hasGoogle ? 'available' : 'disconnected',
      message: hasGoogle ? 'Drive disponible desde la misma sesion de Google.' : 'Drive requiere la misma conexion de Google Workspace.',
      guidance: hasGoogle ? null : 'Conecta Google para habilitar Drive y reuniones desde transcripciones.',
    },
  ];
}
