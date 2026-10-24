import type { VoicePassiveApi } from '../../src/shared/local-voice';
import type { PreloadBridge, SafeIpc } from './types';

export function exposeLocalVoiceApi(bridge: PreloadBridge, { safeInvoke }: SafeIpc): void {
  const api: VoicePassiveApi = {
    getStatus: () => safeInvoke('voice:get-status'),
    setConfig: updates => safeInvoke('voice:set-config', updates),
    start: () => safeInvoke('voice:start'),
    stop: () => safeInvoke('voice:stop'),
    installModel: size => safeInvoke('voice:install-model', size),
    installTtsVoice: id => safeInvoke('voice:install-tts-voice', id),
    listTtsVoices: () => safeInvoke('voice:list-tts-voices'),
    listMicDevices: () => safeInvoke('voice:list-mic-devices'),
    testMic: device => safeInvoke('voice:test-mic', device),
  };
  bridge.exposeInMainWorld('voicePassive', api);
}
