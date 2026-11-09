import { FLOW_MAX_MEDIA_BASE64 } from '../../shared/native-flow';
import { isAudioMimeType, type MediaEnvelope, type MediaRef, type MediaRejection } from '../../shared/multimodal-input';
import { generateNativeFlow, NativeFlowRevokedError } from '../flow-service/native';

export async function prepareAudioEvidence(media: MediaRef[], signal?: AbortSignal) {
  const remaining: MediaRef[] = [];
  const transcripts: string[] = [];
  const rejected: MediaRejection[] = [];
  const sent: MediaEnvelope['sent'] = [];
  for (const ref of media) {
    if (ref.kind !== 'inline' || !isAudioMimeType(ref.mimeType)) {
      remaining.push(ref);
      continue;
    }
    signal?.throwIfAborted();
    try {
      if (ref.base64.length > FLOW_MAX_MEDIA_BASE64) throw new Error('Audio demasiado grande.');
      const mimeType = ref.mimeType === 'audio/x-wav' ? 'audio/wav' : ref.mimeType;
      const raw = await generateNativeFlow({ kind: 'transcription', audio: ref.base64, mimeType });
      signal?.throwIfAborted();
      const value: unknown = JSON.parse(raw);
      const text = value && typeof value === 'object' && 'transcript' in value ? value.transcript : undefined;
      if (typeof text !== 'string' || !text.trim()) throw new Error('Transcripción vacía.');
      transcripts.push(text.trim().slice(0, 20_000));
      sent.push({ kind: 'inline', mimeType, transcribed: true });
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof NativeFlowRevokedError) throw error;
      rejected.push({ reason: 'formato-no-admitido', detail: 'No se pudo transcribir un audio adjunto.' });
    }
  }
  return { remaining, transcripts, rejected, sent };
}
