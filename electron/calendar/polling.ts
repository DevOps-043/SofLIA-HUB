import type { CalendarServiceCore } from './types';
import { calendarSession } from './session-context';
import { createLogger } from '../utils/logger';

const log = createLogger('calendario-polling');
const runs = new WeakMap<CalendarServiceCore, { active: boolean; pending: boolean }>();

export function startPolling(service: CalendarServiceCore, intervalMs = 60000): void {
  stopPolling(service);
  if (!service.userId) return;
  if (!Number.isFinite(intervalMs) || intervalMs < 1000 || intervalMs > 3600000) throw new Error('Intervalo de calendario inválido.');
  const context = calendarSession(service);
  const run = { active: true, pending: false }; runs.set(service, run);
  const assert = () => { context(); if (!run.active || runs.get(service) !== run) throw new Error('Consulta de calendario cancelada.'); };
  const poll = async () => {
    if (run.pending || !run.active) return;
    run.pending = true;
    try {
      assert(); const events = await service.getCurrentEvents(); assert();
      const { inWorkHours, currentEvent, nextEvent } = service.checkWorkHours(events);
      assert();
      if (inWorkHours && !service.isInWorkHoursState) {
        service.isInWorkHoursState = true; service.currentWorkEvent = currentEvent;
        service.emit('work-start', { event: currentEvent });
      } else if (!inWorkHours && service.isInWorkHoursState) {
        service.isInWorkHoursState = false; const endedEvent = service.currentWorkEvent; service.currentWorkEvent = null;
        service.emit('work-end', { event: endedEvent });
      }
      assert(); service.emit('poll', { events, inWorkHours, currentEvent, nextEvent });
    } catch {
      try { assert(); } catch { return; }
      log.warn('No se pudo actualizar el calendario automático.');
    } finally { run.pending = false; }
  };
  void poll(); service.pollingInterval = setInterval(() => { void poll(); }, intervalMs);
}

export function stopPolling(service: CalendarServiceCore): void {
  const run = runs.get(service); if (run) run.active = false; runs.delete(service);
  if (service.pollingInterval) clearInterval(service.pollingInterval);
  service.pollingInterval = null; service.isInWorkHoursState = false; service.currentWorkEvent = null;
}
