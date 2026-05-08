import { collectCalendarEvents } from './calendar-collector';
import { checkSystemState } from './system-state';
import { collectUrgentTasks } from './task-collector';
import type { ProactivePayload, ProactiveRuntimeContext } from './types';

export async function collectProactiveData(
  context: ProactiveRuntimeContext,
  session: any,
): Promise<ProactivePayload> {
  const payload: ProactivePayload = {
    calendarEvents: [],
    urgentTasks: [],
    systemAlerts: [],
    timestamp: new Date(),
    userName: session.fullName || session.username || 'Usuario',
  };

  if (context.config.calendarReminders) {
    try {
      payload.calendarEvents = await collectCalendarEvents(context.calendarService);
    } catch (error) {
      console.warn('[ProactiveService] Calendar fetch error:', error);
    }
  }
  if (context.config.taskReminders) {
    try {
      payload.urgentTasks = await collectUrgentTasks(session);
    } catch (error) {
      console.warn('[ProactiveService] IRIS fetch error:', error);
    }
  }
  if (context.config.systemAlerts) {
    try {
      payload.systemAlerts = await checkSystemState();
    } catch (error) {
      console.warn('[ProactiveService] System check error:', error);
    }
  }

  return payload;
}
