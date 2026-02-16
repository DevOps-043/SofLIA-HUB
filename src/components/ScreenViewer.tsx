import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  isScreen: boolean;
}

export const ScreenViewer: React.FC = () => {
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
      if (dataUrl) {
        setScreenshot(dataUrl);
      }
    } catch (err) {
      console.error('Error capturing screen:', err);
    } finally {
      setCapturing(false);
    }
  }, [selectedSourceId]);

  const loadSources = useCallback(async () => {
    if (!window.screenCapture) return;
    try {
      const srcs = await window.screenCapture.getScreenSources();
      setSources(srcs);
    } catch (err) {
      console.error('Error loading sources:', err);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      captureScreen();
      intervalRef.current = setInterval(captureScreen, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, captureScreen]);

  // Captura inicial
  useEffect(() => {
    captureScreen();
  }, [captureScreen]);

  const selectedSourceName = sources.find(s => s.id === selectedSourceId)?.name || 'Pantalla principal';

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-background-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-primary dark:text-white">
            Ver Pantalla
          </h2>
          <span className="text-xs text-secondary">
            {selectedSourceName}
          </span>
          {autoRefresh && (
            <span className="flex items-center gap-1 text-xs text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              En vivo
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de fuente */}
          <button
            onClick={() => {
              loadSources();
              setShowSourcePicker(!showSourcePicker);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-secondary transition-colors"
          >
            Fuente
          </button>

          {/* Toggle auto-refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              autoRefresh
                ? 'bg-accent text-white border-accent'
                : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-secondary'
            }`}
          >
            {autoRefresh ? 'Detener' : 'Auto'}
          </button>

          {/* Capturar manual */}
          <button
            onClick={captureScreen}
            disabled={capturing}
            className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {capturing ? 'Capturando...' : 'Capturar'}
          </button>
        </div>
      </div>

      {/* Source Picker Dropdown */}
      {showSourcePicker && sources.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
          <p className="text-xs text-secondary mb-2">Seleccionar fuente:</p>
          <div className="flex flex-wrap gap-2">
            {sources.map(source => (
              <button
                key={source.id}
                onClick={() => {
                  setSelectedSourceId(source.id);
                  setShowSourcePicker(false);
                  setScreenshot(null);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  selectedSourceId === source.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 text-primary dark:text-gray-300'
                }`}
              >
                <img
                  src={source.thumbnail}
                  alt={source.name}
                  className="w-12 h-7 rounded object-cover border border-gray-200 dark:border-white/10"
                />
                <span className="max-w-[120px] truncate">
                  {source.isScreen ? `Pantalla ${source.name}` : source.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Screenshot Display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {screenshot ? (
          <img
            src={screenshot}
            alt="Screen capture"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-gray-200 dark:border-white/10"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">
              {capturing ? 'Capturando pantalla...' : 'Haz click en "Capturar" para ver tu pantalla'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
