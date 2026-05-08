import type { CalendarService } from '../calendar-service';

export function appendGoogleConnectionContext(
  systemPrompt: string,
  calendarService: CalendarService | null,
): string {
  if (!calendarService) {
    console.warn('[WhatsApp Agent] calendarService is null - Google APIs unavailable');
    return systemPrompt;
  }

  const connections = calendarService.getConnections();
  const googleConnection = connections.find((connection: any) => connection.provider === 'google');
  console.log(
    `[WhatsApp Agent] Google connection state: ${
      googleConnection ? `active=${googleConnection.isActive}, email=${googleConnection.email}` : 'NOT CONNECTED'
    }`,
  );

  const hasGoogle = connections.some((connection: any) => connection.provider === 'google' && connection.isActive);
  if (hasGoogle) {
    return systemPrompt;
  }

  return `${systemPrompt}

=== ESTADO DE CONEXION GOOGLE ===
Google NO esta conectado. Si el usuario pide acciones de Calendar, Gmail, eventos o Drive, informale EXPRESAMENTE que debe conectar Google desde la interfaz de SofLIA Hub primero.
PROHIBICIONES ESTRICTAS: NO INTENTES USAR las herramientas de computadora (use_computer, execute_command, open_application) NI el navegador (open_url) para entrar a leer sus correos o ver su calendario. Si no tienes la API de Google conectada, debes NEGARTE a revisar el calendario o correos y guiarlos a conectarse desde cero.`;
}
