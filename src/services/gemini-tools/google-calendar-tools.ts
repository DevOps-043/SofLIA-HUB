import { emptyParams, objectParams, stringProp } from './schema';
import type { GeminiFunctionDeclaration } from './types';

export const GOOGLE_CALENDAR_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  { name: 'google_calendar_get_events', description: 'Obtiene los eventos del calendario del usuario para una fecha.', parameters: objectParams({ date: stringProp('Fecha en formato ISO YYYY-MM-DD. Opcional.') }) },
  { name: 'google_calendar_create', description: 'Crea un nuevo evento en Google Calendar.', parameters: objectParams({ title: stringProp('Titulo del evento.'), start: stringProp('Fecha y hora de inicio ISO 8601.'), end: stringProp('Fecha y hora de fin ISO 8601.'), description: stringProp('Descripcion del evento. Opcional.'), location: stringProp('Ubicacion del evento. Opcional.') }, ['title', 'start', 'end']) },
  { name: 'google_calendar_delete', description: 'Elimina un evento del calendario por su ID.', parameters: objectParams({ event_id: stringProp('ID del evento.') }, ['event_id']) },
  { name: 'google_calendar_get_connections', description: 'Verifica que calendarios estan conectados antes de operar sobre ellos.', parameters: emptyParams() },
];
