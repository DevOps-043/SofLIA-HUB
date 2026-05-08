import { toolError, toolResponse } from '../types';
import type { GoogleExecutorResult } from './types';
import type { ToolExecutorContext } from '../types';

const CALENDAR_TOOLS = new Set(['google_calendar_create', 'google_calendar_get_events', 'google_calendar_delete']);

export async function executeCalendarTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  bulkLabelsToVerify: Set<string> | null,
): Promise<GoogleExecutorResult | null> {
  if (!CALENDAR_TOOLS.has(toolName)) return null;

  if (toolName === 'google_calendar_create') {
    try {
      if (!ctx.calendarService) {
        return { response: toolError(toolName, 'Google Calendar no esta disponible. El usuario debe conectar Google en SofLIA Hub.'), bulkLabelsToVerify };
      }

      const startDate = new Date(toolArgs.start_date);
      const endDate = toolArgs.end_date ? new Date(toolArgs.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000);
      const result = await ctx.calendarService.createEvent({
        title: toolArgs.title,
        start: startDate,
        end: endDate,
        description: toolArgs.description,
        location: toolArgs.location,
      });

      if (!result.success) return { response: toolResponse(toolName, result), bulkLabelsToVerify };

      const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
      return {
        response: toolResponse(toolName, {
          success: true,
          eventId: result.eventId,
          message: `Evento creado en Google Calendar: "${toolArgs.title}" el ${dayNames[startDate.getDay()]} ${startDate.getDate()} de ${monthNames[startDate.getMonth()]} a las ${timeStr}`,
        }),
        bulkLabelsToVerify,
      };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  if (toolName === 'google_calendar_get_events') {
    try {
      if (!ctx.calendarService) return { response: toolError(toolName, 'Google Calendar no conectado.'), bulkLabelsToVerify };
      const start = toolArgs.start_date ? new Date(toolArgs.start_date) : new Date();
      if (!toolArgs.start_date) start.setHours(0, 0, 0, 0);
      const end = toolArgs.end_date ? new Date(toolArgs.end_date) : new Date(start);
      if (!toolArgs.end_date) end.setHours(23, 59, 59, 999);

      const events = await ctx.calendarService.getCurrentEvents(start);
      const formatted = events.map((event: any) => ({
        id: event.id,
        title: event.title,
        start: event.isAllDay ? event.start.toISOString().split('T')[0] : event.start.toLocaleString('es-MX'),
        end: event.isAllDay ? event.end.toISOString().split('T')[0] : event.end.toLocaleString('es-MX'),
        location: event.location || null,
        description: event.description || null,
        isAllDay: event.isAllDay,
      }));

      return {
        response: toolResponse(toolName, {
          success: true,
          request_range: { start: start.toLocaleString('es-MX'), end: end.toLocaleString('es-MX') },
          events: formatted,
          count: formatted.length,
        }),
        bulkLabelsToVerify,
      };
    } catch (err: any) {
      return { response: toolError(toolName, err.message), bulkLabelsToVerify };
    }
  }

  try {
    if (!ctx.calendarService) return { response: toolError(toolName, 'Google Calendar no conectado.'), bulkLabelsToVerify };
    return { response: toolResponse(toolName, await ctx.calendarService.deleteEvent(toolArgs.event_id)), bulkLabelsToVerify };
  } catch (err: any) {
    return { response: toolError(toolName, err.message), bulkLabelsToVerify };
  }
}
