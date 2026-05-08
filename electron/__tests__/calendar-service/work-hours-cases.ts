import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCalendarService } from './setup';
import { resetCalendarMocks } from './mocks';
import type { CalendarEvent, CalendarService } from '../../calendar-service';

describe('CalendarService work-hours detection', () => {
  let service: CalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCalendarMocks();
    service = createCalendarService();
  });

  it('CAL-006: detects current event as work hours', () => {
    const now = new Date();
    const events: CalendarEvent[] = [{
      id: '1',
      title: 'Work',
      source: 'google',
      isAllDay: false,
      start: new Date(now.getTime() - 60_000),
      end: new Date(now.getTime() + 3600_000),
    }];

    const result = service.checkWorkHours(events);
    expect(result.inWorkHours).toBe(true);
    expect(result.currentEvent?.title).toBe('Work');
  });

  it('CAL-007: returns false and nextEvent when no current event exists', () => {
    const now = new Date();
    const events: CalendarEvent[] = [{
      id: '2',
      title: 'Future Meeting',
      source: 'google',
      isAllDay: false,
      start: new Date(now.getTime() + 3600_000),
      end: new Date(now.getTime() + 7200_000),
    }];

    const result = service.checkWorkHours(events);
    expect(result.inWorkHours).toBe(false);
    expect(result.currentEvent).toBeNull();
    expect(result.nextEvent?.title).toBe('Future Meeting');
  });

  it('CAL-008: skips all-day events', () => {
    const now = new Date();
    const events: CalendarEvent[] = [{
      id: '3',
      title: 'Holiday',
      source: 'google',
      isAllDay: true,
      start: new Date(now.getTime() - 86400_000),
      end: new Date(now.getTime() + 86400_000),
    }];

    const result = service.checkWorkHours(events);
    expect(result.inWorkHours).toBe(false);
    expect(result.currentEvent).toBeNull();
  });
});
