// Wrapper tipado de los nueve canales de voz local.
import type { VoicePassiveApi, VoicePassiveConfig, VoicePassiveSnapshot, TtsVoicesSnapshot, MicDevicesSnapshot, MicProbeSnapshot } from '../shared/local-voice';
export type { VoicePassiveConfig, VoicePassiveStatus, TtsVoiceInfo, MicDeviceInfo, VoicePassiveSnapshot, TtsVoicesSnapshot, MicDevicesSnapshot, MicProbeSnapshot } from '../shared/local-voice';
declare global { interface Window { voicePassive?: VoicePassiveApi } }
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

