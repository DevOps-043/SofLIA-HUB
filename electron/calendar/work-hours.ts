import type { CalendarEvent } from './types';

export function checkWorkHours(events: CalendarEvent[]): {
  inWorkHours: boolean;
  currentEvent: CalendarEvent | null;
  nextEvent: CalendarEvent | null;
} {
  const now = new Date();
  let currentEvent: CalendarEvent | null = null;
  let nextEvent: CalendarEvent | null = null;

  for (const event of events) {
    if (event.isAllDay) continue;
    if (now >= event.start && now <= event.end) {
      currentEvent = event;
    } else if (now < event.start && !nextEvent) {
      nextEvent = event;
    }
  }

  return { inWorkHours: currentEvent !== null, currentEvent, nextEvent };
}
