import { afterEach, describe, expect, it, vi } from 'vitest';
import { calendarClient } from '../../services/calendar';
import { executeCalendarTool } from '../../services/gemini-chat/calendar-tools';
import { useCalendarPanel } from '../../components/monitoring/calendar-panel/useCalendarPanel';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { CalendarBridge, CalendarEventDto } from '../../shared/calendar';

const event: CalendarEventDto = { id: 'evento', title: 'Revisión', start: '2026-10-23T16:00:00.000Z', end: '2026-10-23T17:00:00.000Z', isAllDay: false, source: 'google' };
function fixture() {
  const bridge: CalendarBridge = {
    getEvents: vi.fn(async () => ({ success: true, events: [event] })),
    getConnections: vi.fn(async () => []), getStatus: vi.fn(async () => ({ isPolling: false, inWorkHours: false, currentEvent: null })),
    connectGoogle: vi.fn(async () => ({ success: true })), connectMicrosoft: vi.fn(async () => ({ success: true })),
    disconnect: vi.fn(async () => ({ success: true })), startAuto: vi.fn(async () => ({ success: true })), stopAuto: vi.fn(async () => ({ success: true })),
    createEvent: vi.fn(async () => ({ success: true, eventId: 'nuevo' })), updateEvent: vi.fn(async () => ({ success: true })), deleteEvent: vi.fn(async () => ({ success: true })),
    onConnected: vi.fn(() => () => {}), onDisconnected: vi.fn(() => () => {}), onWorkStart: vi.fn(() => () => {}),
    onWorkEnd: vi.fn(() => () => {}), onPoll: vi.fn(() => () => {}), removeListeners: vi.fn(),
  };
  window.calendar = bridge; return bridge;
}
afterEach(() => { delete window.calendar; });
describe('Calendario del renderer', () => {
  it('desenvuelve el sobre y propaga errores controlados', async () => {
    const bridge = fixture(); const client = calendarClient(bridge)!;
    expect(await client.getEvents()).toEqual([event]);
    vi.mocked(bridge.getEvents).mockResolvedValueOnce({ success: false, events: [], error: 'Sin sesión' });
    await expect(client.getEvents()).rejects.toThrow('Sin sesión');
  });
  it('el chat crea y filtra con el contrato ISO del servicio', async () => {
    const bridge = fixture(); const apis = { cal: calendarClient(bridge), gmail: null, drive: null };
    const input = { title: 'Revisión', start: event.start, end: event.end };
    expect(JSON.parse((await executeCalendarTool('google_calendar_create', input, apis))!)).toMatchObject({ success: true });
    expect(bridge.createEvent).toHaveBeenCalledWith({ ...input, description: '', location: '' });
    expect(JSON.parse((await executeCalendarTool('google_calendar_get_events', { date: '2026-10-23' }, apis))!).events).toEqual([event]);
    expect(JSON.parse((await executeCalendarTool('google_calendar_get_events', { date: '2026-10-24' }, apis))!).events).toEqual([]);
  });
  it('el panel consume eventos del sobre sin fallar ni confundir errores con vacío', async () => {
    const bridge = fixture(); const { result, unmount } = renderHook(() => useCalendarPanel());
    await waitFor(() => expect(bridge.getEvents).toHaveBeenCalled());
    await act(async () => { await result.current.refreshEvents(); });
    expect(result.current.error).toBeNull();
    vi.mocked(bridge.getEvents).mockResolvedValueOnce({ success: false, events: [], error: 'No hay sesión' });
    await act(async () => { await result.current.refreshEvents(); });
    expect(result.current.error).toBe('No hay sesión');
    unmount();
  });
  it('la cancelación nativa se conserva como resultado de la herramienta', async () => {
    const bridge = fixture(); vi.mocked(bridge.deleteEvent).mockResolvedValueOnce({ success: false, cancelled: true });
    const value = await executeCalendarTool('google_calendar_delete', { event_id: event.id }, { cal: calendarClient(bridge), gmail: null, drive: null });
    expect(JSON.parse(value!)).toEqual({ success: false, cancelled: true });
  });
});
