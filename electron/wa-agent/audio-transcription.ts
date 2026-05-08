import type { GoogleGenerativeAI } from '@google/generative-ai';
import { WA_MODEL } from './constants';

export async function transcribeWhatsAppAudio(ai: GoogleGenerativeAI, audioBuffer: Buffer): Promise<string> {
  const model = ai.getGenerativeModel({ model: WA_MODEL });
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'audio/ogg',
        data: audioBuffer.toString('base64'),
      },
    },
    'Transcribe este audio a texto. Solo devuelve la transcripcion exacta de lo que dice la persona, sin agregar nada mas. Si no puedes entenderlo, responde con una cadena vacia.',
  ]);

  return result.response.text().trim();
}
