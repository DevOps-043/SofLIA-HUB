import { FLOW_MAX_AUDIO_BYTES } from '../../shared/native-flow';
import { observeFlowSession } from './session';
import { generateNativeFlow } from './native';
import { asString, parseJsonPayload } from './normalizers';

function readBlobAsBase64(audioBlob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Value = reader.result as string;
      resolve(base64Value.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('No pude leer el audio.'));
    reader.readAsDataURL(audioBlob);
  });
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (audioBlob.size > FLOW_MAX_AUDIO_BYTES) throw new Error('El audio excede el tamaño permitido de 12 MiB. Graba un fragmento más corto.');
  const scope = observeFlowSession();
  try {
    const base64Data = await readBlobAsBase64(audioBlob);
    scope.assert();
    const native = await generateNativeFlow({ kind: 'transcription', audio: base64Data, mimeType: audioBlob.type || 'audio/webm' });
    scope.assert();
    return asString(parseJsonPayload<{ transcript?: unknown }>(native.trim()).transcript);
  } catch (error) {
    scope.assert();
    console.error('[Flow] No se pudo transcribir el audio.');
    throw error;
  } finally { scope.dispose(); }
}
