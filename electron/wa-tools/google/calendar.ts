import type { GoogleToolDeclaration } from './types';

export const CALENDAR_TOOLS: GoogleToolDeclaration[] = [
  {
    name: 'google_calendar_create',
    description: 'Crea un evento directamente en Google Calendar. Requiere Google conectado en SofLIA Hub.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Titulo del evento.' },
        start_date: { type: 'STRING', description: 'Fecha/hora inicio ISO: 2025-03-15T09:00:00.' },
        end_date: { type: 'STRING', description: 'Fecha/hora fin. Si falta, dura 1 hora.' },
        description: { type: 'STRING', description: 'Descripcion del evento.' },
        location: { type: 'STRING', description: 'Ubicacion del evento.' },
      },
      required: ['title', 'start_date'],
    },
  },
  {
    name: 'google_calendar_get_events',
    description: 'Obtiene eventos del calendario en un rango de fechas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        start_date: { type: 'STRING', description: 'Inicio ISO. Si falta, usa el inicio de hoy.' },
        end_date: { type: 'STRING', description: 'Fin ISO. Si falta, usa el final del dia.' },
      },
    },
  },
  {
    name: 'google_calendar_delete',
    description: 'Elimina un evento de Google Calendar por ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        event_id: { type: 'STRING', description: 'ID del evento a eliminar.' },
      },
      required: ['event_id'],
    },
  },
];
