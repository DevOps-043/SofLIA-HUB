import type {
  PreloadBridge,
  SafeIpc,
} from './types';

export function exposeCalendarApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn, safeRemoveAllListeners } = ipc;
  bridge.exposeInMainWorld('calendar', {
    connectGoogle: () => safeInvoke('calendar:connect-google'),
    connectMicrosoft: () => safeInvoke('calendar:connect-microsoft'),
    disconnect: (provider: string) => safeInvoke('calendar:disconnect', provider),
    getEvents: () => safeInvoke('calendar:get-events'),
    getConnections: () => safeInvoke('calendar:get-connections'),
    startAuto: () => safeInvoke('calendar:start-auto'),
    stopAuto: () => safeInvoke('calendar:stop-auto'),
    getStatus: () => safeInvoke('calendar:get-status'),
    createEvent: (event: any) => safeInvoke('calendar:create-event', event),
    updateEvent: (eventId: string, updates: any) => safeInvoke('calendar:update-event', eventId, updates),
    deleteEvent: (eventId: string, calendarId?: string) =>
      safeInvoke('calendar:delete-event', eventId, calendarId),
    onWorkStart: (cb: (data: any) => void) => safeOn('calendar:work-start', cb),
    onWorkEnd: (cb: (data: any) => void) => safeOn('calendar:work-end', cb),
    onConnected: (cb: (data: any) => void) => safeOn('calendar:connected', cb),
    onDisconnected: (cb: (data: any) => void) => safeOn('calendar:disconnected', cb),
    onPoll: (cb: (data: any) => void) => safeOn('calendar:poll', cb),
    removeListeners: () => [
      'calendar:work-start',
      'calendar:work-end',
      'calendar:connected',
      'calendar:disconnected',
      'calendar:poll',
      'calendar:token-refreshed',
    ].forEach(safeRemoveAllListeners),
  });
}
