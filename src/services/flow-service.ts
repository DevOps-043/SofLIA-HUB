
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY } from '../config';
import { getApiKeyWithCache } from './api-keys';
import { FLOW_REFINER_PROMPT } from '../prompts/flow';

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface FlowResult {
  text: string;
  sources?: GroundingSource[];
}

async function getGenAI(): Promise<GoogleGenerativeAI> {
  const dbApiKey = await getApiKeyWithCache('google');
  const key = dbApiKey || GOOGLE_API_KEY || '';
  return new GoogleGenerativeAI(key);
}

export async function refineFlowText(text: string, base64Image?: string): Promise<FlowResult> {
  try {
    const ai = await getGenAI();
    // Usamos el modelo más estable del mercado para evitar errores de conexión
    const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const parts: any[] = [`${FLOW_REFINER_PROMPT}\n\nPregunta del usuario: ${text}`];
    
    if (base64Image) {
      parts.push({
        inlineData: {
          data: base64Image,
          mimeType: "image/png"
        }
      });
    }

    const result = await model.generateContent(parts);
    const responseText = result.response.text().trim();

    return { text: responseText };
  } catch (error) {
    console.error('Flow Service Error:', error);
    return { text: "No pude procesar la inteligencia. Revisa tu conexión o intenta dictar de nuevo." };
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });
    
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1]);
      };
      reader.readAsDataURL(audioBlob);
    });

    const base64Data = await base64Promise;
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: audioBlob.type || 'audio/webm'
        }
      },
      "Transcribe el audio a texto. Idioma: ESPAÑOL. Solo el texto, sin comentarios extra."
    ]);

    return result.response.text().trim();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
}
