import type { CalendarServiceCore } from './types';

export function startPolling(service: CalendarServiceCore, intervalMs: number = 60000): void {
  if (service.pollingInterval) clearInterval(service.pollingInterval);
  console.log(`[CalendarService] Polling started (every ${intervalMs / 1000}s)`);

  const poll = async () => {
    try {
      const events = await service.getCurrentEvents();
      const { inWorkHours, currentEvent, nextEvent } = service.checkWorkHours(events);
      if (inWorkHours && !service.isInWorkHoursState) {
        service.isInWorkHoursState = true;
        service.currentWorkEvent = currentEvent;
        service.emit('work-start', { event: currentEvent });
      } else if (!inWorkHours && service.isInWorkHoursState) {
        service.isInWorkHoursState = false;
        const endedEvent = service.currentWorkEvent;
        service.currentWorkEvent = null;
        service.emit('work-end', { event: endedEvent });
      }
      service.emit('poll', { events, inWorkHours, currentEvent, nextEvent });
    } catch (err: any) {
      console.error('[CalendarService] Poll error:', err.message);
    }
  };

  poll();
  service.pollingInterval = setInterval(poll, intervalMs);
}

export function stopPolling(service: CalendarServiceCore): void {
  if (service.pollingInterval) {
    clearInterval(service.pollingInterval);
    service.pollingInterval = null;
  }
  service.isInWorkHoursState = false;
  service.currentWorkEvent = null;
  console.log('[CalendarService] Polling stopped');
}
