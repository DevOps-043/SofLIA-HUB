import { z } from 'zod';
import type { CalendarEvent } from './types';
import type { CalendarEventDto } from '../../src/shared/calendar';

export const providerSchema = z.enum(['google', 'microsoft']);
export const calendarIdSchema = z.string().trim().min(1).max(1024).refine(value => [...value].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127));
const instant = z.iso.datetime({ offset: true }).refine(value => Number.isFinite(Date.parse(value)));
const fields = {
  title: z.string().trim().min(1).max(500), start: instant, end: instant,
  description: z.string().max(10000).optional(), location: z.string().max(1000).optional(),
  calendarId: calendarIdSchema.optional(),
};
export const createEventSchema = z.object(fields).strict().refine(value => Date.parse(value.end) > Date.parse(value.start));
export const updateEventSchema = z.object(fields).partial().strict()
  .refine(value => Object.keys(value).some(key => key !== 'calendarId'))
  .refine(value => Boolean(value.start) === Boolean(value.end))
  .refine(value => !value.start || !value.end || Date.parse(value.end) > Date.parse(value.start));

/** Proyección explícita: Date no cruza el saneador genérico de preload. */
export function calendarEventDto(event: CalendarEvent | null): CalendarEventDto | null {
  if (!event) return null;
  return { id: event.id, title: event.title, start: event.start.toISOString(), end: event.end.toISOString(),
    isAllDay: event.isAllDay, source: event.source,
    ...(event.location === undefined ? {} : { location: event.location }),
    ...(event.description === undefined ? {} : { description: event.description }) };
}
