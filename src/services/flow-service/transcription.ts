import { FLOW_TRANSCRIPTION_MODEL } from './constants';
import { getGenAI } from './ai-client';
import { asString, parseJsonPayload } from './normalizers';
import { FLOW_TRANSCRIPTION_PROMPT } from '../../prompts/flow';

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
  try {
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({
      model: FLOW_TRANSCRIPTION_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const base64Data = await readBlobAsBase64(audioBlob);
    const result = await model.generateContent([
      { text: FLOW_TRANSCRIPTION_PROMPT },
      {
        inlineData: {
          data: base64Data,
          mimeType: audioBlob.type || 'audio/webm',
        },
      },
    ]);

    const parsed = parseJsonPayload<{ transcript?: unknown }>(result.response.text().trim());
    return asString(parsed.transcript);
  } catch (error) {
    console.error('Flow transcription error:', error);
    throw error;
  }
}
