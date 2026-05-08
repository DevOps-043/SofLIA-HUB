import type { CalendarService } from '../calendar-service';
import type { SmartFocusStatus } from './types';

export async function createCalendarFocusEvent(
  calendarService: CalendarService | undefined,
  start: Date,
  end: Date,
): Promise<string | undefined> {
  if (!calendarService) {
    console.warn('[SmartFocus] Servicio de calendario no disponible para registrar la sesion.');
    return undefined;
  }

  const result = await calendarService.createEvent({
    title: 'Modo Concentracion - SofLIA',
    start,
    end,
    description: 'Sesion de trabajo enfocada generada automaticamente por SofLIA Hub. Por favor, no interrumpir.',
  });

  if (result.success && result.eventId) {
    console.log(`[SmartFocus] Evento creado en el calendario: ID ${result.eventId}`);
    return result.eventId;
  }

  console.warn(`[SmartFocus] No se pudo crear evento en el calendario: ${result.error}`);
  return undefined;
}

export async function finishCalendarEventEarly(
  calendarService: CalendarService | undefined,
  status: SmartFocusStatus,
  isAuto: boolean,
): Promise<void> {
  if (!calendarService || !status.eventId || isAuto || !status.endTime) return;

  const now = new Date();
  if (now >= status.endTime) return;

  const result = await calendarService.updateEvent(status.eventId, { end: now });
  if (result.success) {
    console.log('[SmartFocus] Evento de calendario finalizado prematuramente con exito.');
  } else {
    console.warn(`[SmartFocus] Fallo al actualizar evento de calendario: ${result.error}`);
  }
}
