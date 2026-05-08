import { expect, it } from 'vitest';
import type { CalendarEvent } from '../../calendar-service';
import type { CalendarServiceTestContext } from './types';

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  const now = new Date();
  return {
    id: 'event-id',
    title: 'Work',
    source: 'google',
    isAllDay: false,
    start: new Date(now.getTime() - 60_000),
    end: new Date(now.getTime() + 3600_000),
    ...overrides,
  };
}

export function registerCalendarWorkHourTests(ctx: CalendarServiceTestContext) {
  it('CAL-006: checkWorkHours detects current event as in work hours', () => {
    const result = ctx.getService().checkWorkHours([event({ id: '1', title: 'Work' })]);
    expect(result.inWorkHours).toBe(true);
    expect(result.currentEvent?.title).toBe('Work');
  });

  it('CAL-007: checkWorkHours returns false when no current event', () => {
    const now = new Date();
    const result = ctx.getService().checkWorkHours([
      event({
        id: '2',
        title: 'Future Meeting',
        start: new Date(now.getTime() + 3600_000),
        end: new Date(now.getTime() + 7200_000),
      }),
    ]);

    expect(result.inWorkHours).toBe(false);
    expect(result.currentEvent).toBeNull();
    expect(result.nextEvent?.title).toBe('Future Meeting');
  });

  it('CAL-008: checkWorkHours skips all-day events', () => {
    const now = new Date();
    const result = ctx.getService().checkWorkHours([
      event({
        id: '3',
        title: 'Holiday',
        isAllDay: true,
        start: new Date(now.getTime() - 86400_000),
        end: new Date(now.getTime() + 86400_000),
      }),
    ]);
    expect(result.inWorkHours).toBe(false);
    expect(result.currentEvent).toBeNull();
  });

  it('CAL-010: getPollingStatus returns not polling by default', () => {
    expect(ctx.getService().getPollingStatus()).toMatchObject({
      isPolling: false,
      inWorkHours: false,
      currentEvent: null,
    });
  });
}
