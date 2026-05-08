import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScreenSource } from './types';

export function useScreenCapture() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const captureScreen = useCallback(async () => {
    if (!window.screenCapture) return;
    setCapturing(true);
    try {
      const dataUrl = await window.screenCapture.captureScreen(selectedSourceId);
      if (dataUrl) setScreenshot(dataUrl);
    } catch (err) {
      console.error('Error capturing screen:', err);
    } finally {
      setCapturing(false);
    }
  }, [selectedSourceId]);

  const loadSources = useCallback(async () => {
    if (!window.screenCapture) return;
    try {
      const nextSources = await window.screenCapture.getScreenSources();
      setSources(nextSources);
    } catch (err) {
      console.error('Error loading sources:', err);
    }
  }, []);

  const toggleSourcePicker = useCallback(() => {
    loadSources();
    setShowSourcePicker((current) => !current);
  }, [loadSources]);

  const selectSource = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
    setShowSourcePicker(false);
    setScreenshot(null);
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      clearRefreshTimer(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    captureScreen();
    intervalRef.current = setInterval(captureScreen, 2000);
    return () => clearRefreshTimer(intervalRef.current);
  }, [autoRefresh, captureScreen]);

  useEffect(() => {
    captureScreen();
  }, [captureScreen]);

  const selectedSourceName = sources.find((source) => source.id === selectedSourceId)?.name || 'Pantalla principal';

  return {
    screenshot,
    sources,
    selectedSourceId,
    selectedSourceName,
    autoRefresh,
    capturing,
    showSourcePicker,
    captureScreen,
    selectSource,
    setAutoRefresh,
    toggleSourcePicker,
  };
}

function clearRefreshTimer(timer: ReturnType<typeof setInterval> | null) {
  if (timer) clearInterval(timer);
}
