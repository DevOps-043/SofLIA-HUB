// Wrapper del renderer para la voz pasiva local (runtime Python + Vosk).
// Todos los llamados van por IPC allowlisted (canales voice:*).

export interface VoicePassiveConfig {
  enabled: boolean;
  wakeWords: string[];
  modelPath?: string;
  micDevice?: string | number | null;
  /** Voz Piper del TTS local de la orbe. */
  ttsVoice: string;
  ttsSpeed: number;
}

export interface TtsVoiceInfo {
  id: string;
  label: string;
  installed: boolean;
}

export interface MicDeviceInfo {
  index: number;
  name: string;
  default: boolean;
}

export interface MicProbeSnapshot {
  success: boolean;
  rms?: number;
  peak?: number;
  hasSignal?: boolean;
  error?: string;
}

export interface MicDevicesSnapshot {
  success: boolean;
  devices?: MicDeviceInfo[];
  error?: string;
}

export interface VoicePassiveStatus {
  runtimeAvailable: boolean;
  sidecarRunning: boolean;
  listening: boolean;
  enabled: boolean;
  pythonPath: string;
  modelPath: string | null;
  largeModelInstalled: boolean;
  modelDownloadProgress: number | null;
  ttsReady: boolean;
  ttsDownloadProgress: number | null;
  dictating: boolean;
  lastError: string | null;
}

export interface VoicePassiveSnapshot {
  success: boolean;
  status?: VoicePassiveStatus;
  config?: VoicePassiveConfig;
  error?: string;
}

export interface TtsVoicesSnapshot {
  success: boolean;
  voices?: TtsVoiceInfo[];
  status?: VoicePassiveStatus;
  error?: string;
}

declare global {
  interface Window {
    voicePassive?: {
      getStatus: () => Promise<VoicePassiveSnapshot>;
      setConfig: (updates: Partial<VoicePassiveConfig>) => Promise<VoicePassiveSnapshot>;
      start: () => Promise<VoicePassiveSnapshot>;
      stop: () => Promise<VoicePassiveSnapshot>;
      installModel: (size?: 'small' | 'large') => Promise<VoicePassiveSnapshot>;
      installTtsVoice: (voiceId: string) => Promise<TtsVoicesSnapshot>;
      listTtsVoices: () => Promise<TtsVoicesSnapshot>;
      listMicDevices: () => Promise<MicDevicesSnapshot>;
      testMic: (device: string | number | null) => Promise<MicProbeSnapshot>;
    };
  }
}

function api() {
  const bridge = window.voicePassive;
  if (!bridge) throw new Error('La API de voz pasiva no está disponible en este entorno.');
  return bridge;
}

export const voicePassiveService = {
  isAvailable(): boolean {
    return typeof window.voicePassive !== 'undefined';
  },
  getStatus(): Promise<VoicePassiveSnapshot> {
    return api().getStatus();
  },
  setConfig(updates: Partial<VoicePassiveConfig>): Promise<VoicePassiveSnapshot> {
    return api().setConfig(updates);
  },
  start(): Promise<VoicePassiveSnapshot> {
    return api().start();
  },
  stop(): Promise<VoicePassiveSnapshot> {
    return api().stop();
  },
  installModel(size?: 'small' | 'large'): Promise<VoicePassiveSnapshot> {
    return api().installModel(size);
  },
  installTtsVoice(voiceId: string): Promise<TtsVoicesSnapshot> {
    return api().installTtsVoice(voiceId);
  },
  listTtsVoices(): Promise<TtsVoicesSnapshot> {
    return api().listTtsVoices();
  },
  listMicDevices(): Promise<MicDevicesSnapshot> {
    return api().listMicDevices();
  },
  testMic(device: string | number | null): Promise<MicProbeSnapshot> {
    return api().testMic(device);
  },
};
