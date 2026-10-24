/** Contrato de voz local; las rutas del host permanecen exclusivamente en main. */
export interface VoicePassiveConfig {
  enabled: boolean;
  wakeWords: string[];
  micDevice?: string | number | null;
  ttsVoice: string;
  ttsSpeed: number;
}
export interface TtsVoiceInfo { id: string; label: string; installed: boolean }
export interface MicDeviceInfo { index: number; name: string; default: boolean }
export interface VoicePassiveStatus {
  runtimeAvailable: boolean;
  sidecarRunning: boolean;
  listening: boolean;
  enabled: boolean;
  modelInstalled: boolean;
  approvalRequired: boolean;
  largeModelInstalled: boolean;
  modelDownloadProgress: number | null;
  ttsReady: boolean;
  ttsDownloadProgress: number | null;
  dictating: boolean;
  lastError: string | null;
}
export interface VoiceResult { success: boolean; error?: string; code?: string; uncertain?: boolean; recoveryRequired?: boolean }
export interface VoicePassiveSnapshot extends VoiceResult { status?: VoicePassiveStatus; config?: VoicePassiveConfig }
export interface TtsVoicesSnapshot extends VoiceResult { voices?: TtsVoiceInfo[]; status?: VoicePassiveStatus }
export interface MicDevicesSnapshot extends VoiceResult { devices?: MicDeviceInfo[] }
export interface MicProbeSnapshot extends VoiceResult { rms?: number; peak?: number; hasSignal?: boolean }
export interface VoicePassiveApi {
  getStatus(): Promise<VoicePassiveSnapshot>;
  setConfig(updates: Partial<VoicePassiveConfig>): Promise<VoicePassiveSnapshot>;
  start(): Promise<VoicePassiveSnapshot>;
  stop(): Promise<VoicePassiveSnapshot>;
  installModel(size?: 'small' | 'large'): Promise<VoicePassiveSnapshot>;
  installTtsVoice(voiceId: string): Promise<TtsVoicesSnapshot>;
  listTtsVoices(): Promise<TtsVoicesSnapshot>;
  listMicDevices(): Promise<MicDevicesSnapshot>;
  testMic(device: string | number | null): Promise<MicProbeSnapshot>;
}
