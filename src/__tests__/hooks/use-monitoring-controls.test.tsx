import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMonitoringStatus = vi.fn();
const startMonitoringSession = vi.fn();
const stopMonitoringSession = vi.fn();
const persistSnapshots = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);

vi.mock('../../services/monitoring-service', () => ({
  getMonitoringStatus: (...args: unknown[]) => getMonitoringStatus(...args),
  startMonitoringSession: (...args: unknown[]) => startMonitoringSession(...args),
  stopMonitoringSession: (...args: unknown[]) => stopMonitoringSession(...args),
  persistSnapshots: (...args: unknown[]) => persistSnapshots(...args),
}));

import { useMonitoringControlsState } from '../../components/monitoring/controls/use-monitoring-controls';

const USER_ID = 'user-1';

const stoppedStatus = {
  isRunning: false,
  sessionId: null,
  userId: null,
  snapshotCount: 0,
  config: { intervalSeconds: 30, idleThresholdSeconds: 120, screenshotEnabled: true, ocrEnabled: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  getMonitoringStatus.mockResolvedValue(stoppedStatus);
  stopMonitoringSession.mockResolvedValue(undefined);
  (window as unknown as { monitoring: unknown }).monitoring = {
    onSnapshot: vi.fn(),
    onFlush: vi.fn(),
    onSessionEnded: vi.fn(),
    onError: vi.fn(),
    removeListeners: vi.fn(),
  };
});

describe('useMonitoringControlsState', () => {
  it('keeps a manual session running when there is no calendar auto session', async () => {
    startMonitoringSession.mockResolvedValue({ id: 'manual-session' });
    const { result } = renderHook(() => useMonitoringControlsState({ userId: USER_ID }));

    await waitFor(() => expect(getMonitoringStatus).toHaveBeenCalled());
    await act(async () => {
      await result.current.handleStart();
    });

    expect(startMonitoringSession).toHaveBeenCalledWith(USER_ID, 'manual');
    expect(result.current.isRunning).toBe(true);
    expect(result.current.status?.sessionId).toBe('manual-session');
  });

  it('rehydrates a session already running in the main process', async () => {
    getMonitoringStatus.mockResolvedValue({ ...stoppedStatus, isRunning: true, sessionId: 'main-session', userId: USER_ID, snapshotCount: 4 });
    const { result } = renderHook(() => useMonitoringControlsState({ userId: USER_ID }));

    await waitFor(() => expect(result.current.isRunning).toBe(true));
    expect(result.current.status?.sessionId).toBe('main-session');
  });

  it('stops the local session when the adopted calendar auto session disappears', async () => {
    const { result, rerender } = renderHook(
      ({ calendarAutoSessionId }: { calendarAutoSessionId?: string | null }) =>
        useMonitoringControlsState({ userId: USER_ID, calendarAutoSessionId }),
      { initialProps: { calendarAutoSessionId: 'calendar-session' as string | null | undefined } },
    );

    await waitFor(() => expect(result.current.isRunning).toBe(true));
    expect(result.current.status?.sessionId).toBe('calendar-session');

    rerender({ calendarAutoSessionId: null });

    await waitFor(() => expect(result.current.isRunning).toBe(false));
  });

  it('does not stop a manual session when a calendar auto session ends afterwards', async () => {
    startMonitoringSession.mockResolvedValue({ id: 'manual-session' });
    const { result, rerender } = renderHook(
      ({ calendarAutoSessionId }: { calendarAutoSessionId?: string | null }) =>
        useMonitoringControlsState({ userId: USER_ID, calendarAutoSessionId }),
      { initialProps: { calendarAutoSessionId: null as string | null | undefined } },
    );

    await waitFor(() => expect(getMonitoringStatus).toHaveBeenCalled());
    await act(async () => {
      await result.current.handleStart();
    });
    expect(result.current.isRunning).toBe(true);

    rerender({ calendarAutoSessionId: null });

    await waitFor(() => expect(result.current.status?.sessionId).toBe('manual-session'));
    expect(result.current.isRunning).toBe(true);
  });
});
