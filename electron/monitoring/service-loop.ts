type CaptureSnapshot = () => Promise<void>;

export function startMonitoringServiceLoop(
  currentInterval: ReturnType<typeof setInterval> | null,
  intervalSeconds: number,
  captureSnapshot: CaptureSnapshot,
  onError: (error: Error) => void,
): ReturnType<typeof setInterval> {
  if (currentInterval) clearInterval(currentInterval);
  return setInterval(() => {
    captureSnapshot().catch((err) => {
      console.error('[MonitoringService] Capture error:', err.message);
      onError(err);
    });
  }, intervalSeconds * 1000);
}

export function stopMonitoringServiceLoop(intervalId: ReturnType<typeof setInterval> | null): null {
  if (intervalId) clearInterval(intervalId);
  return null;
}
