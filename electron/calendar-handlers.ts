import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { registerCalendarEventForwarders } from './calendar/event-forwarder';
import { calendarCaller, calendarConfirmation } from './calendar/ipc-authorization';
import { calendarEventDto, calendarIdSchema, createEventSchema, providerSchema, updateEventSchema } from './calendar/ipc-contract';
import type { CalendarService } from './calendar-service';
import { createLogger } from './utils/logger';
import { withCorrelation } from './utils/correlation';

const log = createLogger('calendario-ipc');

export function registerCalendarHandlers(
  service: CalendarService,
  getMainWindow: () => BrowserWindow | null,
  getOrbWindow: () => BrowserWindow | null = () => null,
): void {
  const windows = () => [getMainWindow(), getOrbWindow()];
  const confirm = calendarConfirmation();
  const safeResult = (result: { success: boolean; error?: string; errorCode?: string; email?: string; eventId?: string }) => result.success
    ? { success: true, ...(result.email ? { email: result.email } : {}), ...(result.eventId ? { eventId: result.eventId } : {}) }
    : { success: false, error: result.errorCode === 'secure_storage_unavailable'
      ? 'El sistema no ofrece almacenamiento cifrado seguro. Activa el llavero del sistema y vuelve a conectar.'
      : 'No se pudo completar la operación con el proveedor de calendario.' };
  const handle = (channel: string, operation: (caller: ReturnType<typeof calendarCaller>, args: unknown[]) => unknown | Promise<unknown>) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => withCorrelation(async () => {
      const caller = calendarCaller(event, windows);
      const start = Date.now();
      try {
        caller.assert();
        if (service.userId !== caller.userId) throw new Error('calendar_owner_mismatch');
        const result = await operation(caller, args);
        caller.assert();
        log.info({ channel, durationMs: Date.now() - start }, 'Solicitud de calendario completada');
        return result;
      } catch {
        // No propagar payload, conexión, error del proveedor ni rutas del host.
        log.warn({ channel, durationMs: Date.now() - start }, 'Solicitud de calendario rechazada o fallida');
        if (channel === 'calendar:get-connections' || channel === 'calendar:get-status') throw new Error('No se pudo consultar el calendario.');
        return { success: false, error: 'No se pudo completar la operación del calendario. Revisa la sesión, los datos y la confirmación.', ...(channel === 'calendar:get-events' ? { events: [] } : {}) };
      } finally { caller.dispose(); }
    }));
  };
  const noArgs = (args: unknown[]) => { if (args.length) throw new Error('unexpected_arguments'); };
  const mutation = async (
    caller: ReturnType<typeof calendarCaller>, detail: string,
    operation: (assert: () => void) => Promise<{ success: boolean; error?: string; eventId?: string }>,
  ) => {
    const connection = service.connections.get('google');
    const owner = connection?.userId; const email = connection?.email;
    let changed = false;
    const invalidate = () => { changed = true; };
    service.on('connected', invalidate); service.on('disconnected', invalidate);
    const assert = () => {
      caller.assert();
      if (changed || owner !== caller.userId || !connection?.isActive || service.connections.get('google') !== connection
        || connection.userId !== owner || connection.email !== email) throw new Error('connection_changed');
    };
    try {
      assert();
      if (!caller.parent || !await confirm(caller.parent, 'Cuenta: ' + (email || 'Google') + '\n' + detail, assert, caller.signal)) return { success: false, cancelled: true };
      assert();
      return safeResult(await operation(assert));
    } finally { service.off('connected', invalidate); service.off('disconnected', invalidate); }
  };
  handle('calendar:connect-google', async (caller, args) => { noArgs(args); return safeResult(await service.connectGoogle(caller.assert, caller.userId!)); });
  handle('calendar:connect-microsoft', async (caller, args) => { noArgs(args); return safeResult(await service.connectMicrosoft(caller.assert, caller.userId!)); });
  handle('calendar:disconnect', async (_caller, args) => {
    if (args.length !== 1) throw new Error('invalid_arguments');
    await service.disconnect(providerSchema.parse(args[0])); return { success: true };
  });
  handle('calendar:get-events', async (caller, args) => {
    noArgs(args); const events = await service.getCurrentEvents(); caller.assert();
    return { success: true, events: events.map(event => calendarEventDto(event)) };
  });
  handle('calendar:get-connections', (_caller, args) => {
    noArgs(args); return service.getConnections().map(({ provider, email, isActive }) => ({ provider, email, isActive }));
  });
  handle('calendar:get-status', (_caller, args) => {
    noArgs(args); const status = service.getPollingStatus();
    return { ...status, currentEvent: calendarEventDto(status.currentEvent) };
  });
  handle('calendar:start-auto', (_caller, args) => { noArgs(args); service.startPolling(); return { success: true }; });
  handle('calendar:stop-auto', (_caller, args) => { noArgs(args); service.stopPolling(); return { success: true }; });
  handle('calendar:create-event', (caller, args) => {
    if (args.length !== 1) throw new Error('invalid_arguments');
    const input = createEventSchema.parse(args[0]);
    return mutation(caller, 'Crear: ' + input.title + '\nCalendario: ' + (input.calendarId || 'primary')
      + '\nInicio: ' + input.start + '\nFin: ' + input.end + '\nDescripción: ' + (input.description || '') + '\nUbicación: ' + (input.location || ''),
    assert => service.createEvent({ ...input, start: new Date(input.start), end: new Date(input.end) }, assert));
  });
  handle('calendar:update-event', (caller, args) => {
    if (args.length !== 2) throw new Error('invalid_arguments');
    const id = calendarIdSchema.parse(args[0]); const input = updateEventSchema.parse(args[1]);
    return mutation(caller, 'Actualizar evento: ' + id + '\nCalendario: ' + (input.calendarId || 'primary') + '\nCambios: ' + JSON.stringify(input),
      assert => service.updateEvent(id, { ...input, start: input.start ? new Date(input.start) : undefined, end: input.end ? new Date(input.end) : undefined }, assert));
  });
  handle('calendar:delete-event', (caller, args) => {
    if (args.length < 1 || args.length > 2) throw new Error('invalid_arguments');
    const id = calendarIdSchema.parse(args[0]); const calendarId = calendarIdSchema.optional().parse(args[1]);
    return mutation(caller, 'Eliminar evento: ' + id + '\nCalendario: ' + (calendarId || 'primary'), assert => service.deleteEvent(id, calendarId, assert));
  });
  registerCalendarEventForwarders(service, getMainWindow);
}
