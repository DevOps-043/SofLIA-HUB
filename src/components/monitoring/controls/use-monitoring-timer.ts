import { useCallback, useRef, useState } from 'react';

export function useMonitoringTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
    }, 1000);
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    startTimeRef.current = null;
    clearTimer();
    setElapsedSeconds(0);
  }, [clearTimer]);

  return { elapsedSeconds, setElapsedSeconds, startTimeRef, clearTimer, startTimer, resetTimer };
}
