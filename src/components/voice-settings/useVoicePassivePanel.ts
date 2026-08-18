import { useCallback, useEffect, useRef, useState } from 'react';

import {
  voicePassiveService,
  type MicDeviceInfo,
  type VoicePassiveConfig,
  type VoicePassiveStatus,
} from '../../services/voice-passive-service';

export type FeedbackTone = 'ok' | 'error';
export type MicResultTone = 'ok' | 'warn' | 'info';

export interface PanelFeedback {
  tone: FeedbackTone;
  message: string;
}

export interface MicResult {
  tone: MicResultTone;
  message: string;
}

const POLL_IDLE_MS = 4_000;
const POLL_DOWNLOADING_MS = 1_000;

/**
 * Estado y acciones del panel de voz pasiva. Vive aparte de la vista porque el
 * panel combina sondeo periodico, descargas largas y comandos al sidecar; la
 * UI solo consume el resultado.
 */
export function useVoicePassivePanel() {
  const available = voicePassiveService.isAvailable();
  const [status, setStatus] = useState<VoicePassiveStatus | null>(null);
  const [config, setConfig] = useState<VoicePassiveConfig | null>(null);
  const [micDevices, setMicDevices] = useState<MicDeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<PanelFeedback | null>(null);
  const [testingMic, setTestingMic] = useState(false);
  const [micResult, setMicResult] = useState<MicResult | null>(null);
  const [wakeWordsInput, setWakeWordsInput] = useState('');
  const wakeWordsTouched = useRef(false);

  const refresh = useCallback(async () => {
    if (!available) return;
    const snapshot = await voicePassiveService.getStatus();
    if (!snapshot.success || !snapshot.status || !snapshot.config) return;
    setStatus(snapshot.status);
    setConfig(snapshot.config);
    // No pisar lo que el usuario esta escribiendo con el valor persistido.
    if (!wakeWordsTouched.current) setWakeWordsInput(snapshot.config.wakeWords.join(', '));
  }, [available]);

  // El guard vive en un ref para que refreshDevices tenga identidad estable y
  // no reactive el efecto que la dispara.
  const loadingDevicesRef = useRef(false);
  const refreshDevices = useCallback(async () => {
    if (!available || loadingDevicesRef.current) return;
    loadingDevicesRef.current = true;
    setLoadingDevices(true);
    try {
      const result = await voicePassiveService.listMicDevices();
      if (result.success && result.devices) setMicDevices(result.devices);
    } catch {
      // El estado del runtime ya explica el fallo; no se duplica el error aqui.
    } finally {
      loadingDevicesRef.current = false;
      setLoadingDevices(false);
    }
  }, [available]);

  const downloading = (status?.modelDownloadProgress ?? null) !== null;

  useEffect(() => {
    if (!available) return;
    let active = true;
    const tick = () => { if (active) void refresh(); };
    // El primer sondeo sale del cuerpo del efecto (microtarea) para no encadenar
    // un render sincrono extra en cada montaje del panel.
    queueMicrotask(tick);
    const interval = window.setInterval(tick, downloading ? POLL_DOWNLOADING_MS : POLL_IDLE_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [available, refresh, downloading]);

  // Los microfonos solo se pueden listar con el sidecar vivo: se pide cuando el
  // runtime pasa a estar disponible, no al montar el panel.
  const runtimeAvailable = Boolean(status?.runtimeAvailable);
  useEffect(() => {
    if (!runtimeAvailable) return;
    queueMicrotask(() => { void refreshDevices(); });
  }, [runtimeAvailable, refreshDevices]);

  const run = useCallback(async (
    action: () => Promise<{ success: boolean; error?: string }>,
    okMessage: string,
  ) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback(result.success
        ? { tone: 'ok', message: okMessage }
        : { tone: 'error', message: result.error ?? 'Ocurrió un error inesperado.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [refresh]);

  // Se extrae el valor primitivo: memorizar sobre `config?.micDevice` hacia que
  // el compilador de React infiriera `config` entero y descartara la memoizacion.
  const micDevice = config?.micDevice ?? null;
  const testMic = useCallback(async () => {
    if (testingMic) return;
    setTestingMic(true);
    setMicResult({ tone: 'info', message: 'Habla ahora durante 3 segundos…' });
    try {
      const result = await voicePassiveService.testMic(micDevice);
      if (!result.success) {
        setMicResult({ tone: 'warn', message: result.error ?? 'No se pudo probar el micrófono.' });
      } else if (result.hasSignal) {
        setMicResult({ tone: 'ok', message: `Se detecta tu voz correctamente (pico ${result.peak}).` });
      } else {
        setMicResult({
          tone: 'warn',
          message: `Casi no llega señal (pico ${result.peak}). Prueba con otro micrófono de la lista, normalmente el de tu diadema.`,
        });
      }
    } catch (error) {
      setMicResult({
        tone: 'warn',
        message: error instanceof Error ? error.message : 'No se pudo probar el micrófono.',
      });
    } finally {
      setTestingMic(false);
    }
  }, [micDevice, testingMic]);

  const parsedWakeWords = wakeWordsInput
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);

  return {
    available,
    status,
    config,
    micDevices,
    loadingDevices,
    busy,
    feedback,
    testingMic,
    micResult,
    wakeWordsInput,
    parsedWakeWords,
    modelInstalled: Boolean(status?.modelPath),
    downloadProgress: status?.modelDownloadProgress ?? null,
    refreshDevices,
    setWakeWordsInput: (value: string) => {
      wakeWordsTouched.current = true;
      setWakeWordsInput(value);
    },
    installModel: (size?: 'small' | 'large') => void run(
      () => voicePassiveService.installModel(size),
      size === 'large' ? 'Modelo grande instalado y activo.' : 'Modelo instalado correctamente.',
    ),
    setEnabled: (next: boolean) => void run(
      () => voicePassiveService.setConfig({ enabled: next }),
      next ? 'Voz pasiva activada.' : 'Voz pasiva desactivada.',
    ),
    setMicDevice: (device: number | null) => {
      setMicResult(null);
      void run(() => voicePassiveService.setConfig({ micDevice: device }), 'Micrófono actualizado.');
    },
    saveWakeWords: () => {
      wakeWordsTouched.current = false;
      void run(
        () => voicePassiveService.setConfig({ wakeWords: parsedWakeWords }),
        'Palabras de activación guardadas.',
      );
    },
    testMic: () => void testMic(),
  };
}

export type VoicePassivePanel = ReturnType<typeof useVoicePassivePanel>;
