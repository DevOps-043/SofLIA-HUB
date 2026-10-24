import type { CalendarBridge } from '../../src/shared/calendar';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeCalendarApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners } = ipc;
  const api: CalendarBridge = {
    connectGoogle: () => safeInvoke('calendar:connect-google'),
    connectMicrosoft: () => safeInvoke('calendar:connect-microsoft'),
    disconnect: provider => safeInvoke('calendar:disconnect', provider),
    getEvents: () => safeInvoke('calendar:get-events'),
    getConnections: () => safeInvoke('calendar:get-connections'),
    startAuto: () => safeInvoke('calendar:start-auto'), stopAuto: () => safeInvoke('calendar:stop-auto'),
    getStatus: () => safeInvoke('calendar:get-status'),
    createEvent: input => safeInvoke('calendar:create-event', input),
    updateEvent: (eventId, input) => safeInvoke('calendar:update-event', eventId, input),
    deleteEvent: (eventId, calendarId) => safeInvoke('calendar:delete-event', eventId, calendarId),
    onWorkStart: cb => safeOn('calendar:work-start', cb), onWorkEnd: cb => safeOn('calendar:work-end', cb),
    onConnected: cb => safeOn('calendar:connected', cb), onDisconnected: cb => safeOn('calendar:disconnected', cb),
    onPoll: cb => safeOn('calendar:poll', cb),
    removeListeners: () => ['calendar:work-start', 'calendar:work-end', 'calendar:connected', 'calendar:disconnected',
      'calendar:poll', 'calendar:token-refreshed'].forEach(safeRemoveAllListeners),
  };
  bridge.exposeInMainWorld('calendar', api);
}
