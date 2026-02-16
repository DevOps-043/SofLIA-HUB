
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY } from '../config';
import { getApiKeyWithCache } from './api-keys';
import { FLOW_REFINER_PROMPT } from '../prompts/flow';

let genAI: GoogleGenerativeAI | null = null;
let currentApiKey: string | null = null;

async function getGenAI(): Promise<GoogleGenerativeAI> {
  const dbApiKey = await getApiKeyWithCache('google');
  const key = dbApiKey || GOOGLE_API_KEY || '';
  
  if (!genAI || currentApiKey !== key) {
    genAI = new GoogleGenerativeAI(key);
    currentApiKey = key;
  }
  return genAI;
}

export async function refineFlowText(text: string): Promise<string> {
  try {
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: FLOW_REFINER_PROMPT
    });

    const result = await model.generateContent(text);
    return result.response.text();
  } catch (error) {
    console.error('Flow refinement error:', error);
    return text;
  }
}

export async function refineFlowAudio(audioBlob: Blob): Promise<string> {
  try {
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: "Eres SofLIA. Tu tarea es transcribir el audio y luego refinar el texto para que sea claro, profesional y bien puntuado. Responde SOLO con el texto refinado."
    });

    // Convert blob to base64
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
          mimeType: 'audio/webm'
        }
      },
      "Transcribe y refina este dictado."
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Flow audio processing error:', error);
    throw error;
  }
}
