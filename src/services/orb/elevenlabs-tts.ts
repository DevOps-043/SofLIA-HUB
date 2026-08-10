import { orbService } from '../orb-service';

export interface ElevenLabsSpeechAudio {
  audioBase64: string;
  mimeType: 'audio/mpeg';
  voiceId: string;
  modelId: string;
}

/** Solicita audio ElevenLabs a Electron main; ninguna credencial cruza IPC. */
export async function synthesizeElevenLabsSpeech(text: string): Promise<ElevenLabsSpeechAudio> {
  const result = await orbService.synthesize(text);
  if (!result.success || !result.audioBase64 || result.mimeType !== 'audio/mpeg') {
    throw new Error(result.error || 'No se pudo sintetizar la voz con ElevenLabs.');
  }
  return {
    audioBase64: result.audioBase64,
    mimeType: result.mimeType,
    voiceId: result.voiceId ?? '',
    modelId: result.modelId ?? '',
  };
}
