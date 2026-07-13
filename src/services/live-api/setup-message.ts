import { MODELS } from '../../config';

const LIVE_VOICE_STORAGE_KEY = 'soflia-live-voice';
const DEFAULT_LIVE_VOICE = 'Aoede';

/** Voz prebuilt del Live API (configurable via localStorage; default Aoede). */
function getStoredLiveVoice(): string {
  try {
    return localStorage.getItem(LIVE_VOICE_STORAGE_KEY) || DEFAULT_LIVE_VOICE;
  } catch {
    return DEFAULT_LIVE_VOICE;
  }
}

export function buildSetupMessage(includeTools: boolean): any {
  const setupMessage: any = {
    setup: {
      model: `models/${MODELS.LIVE}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: getStoredLiveVoice() } },
        },
        // Gemini 3.1 Live usa thinkingLevel (no thinkingBudget); minimal = menor
        // latencia de respuesta, lo correcto para conversacion de voz en vivo.
        thinkingConfig: { thinkingLevel: 'minimal' },
      },
      systemInstruction: {
        parts: [{
          text: `Eres Lia, la asistente de productividad e investigación de SofLIA Hub.

REGLAS OBLIGATORIAS:
1. Responde SIEMPRE en ESPAÑOL. No uses inglés incluso si el usuario lo hace.
2. Formato de respuesta PLANO:
   USER_QUERY: [Resumen]
   SOFLIA_RESPONSE: [Respuesta extensa en párrafos continuos]
3. PROHIBIDO: No uses negritas (**), no uses encabezados (#), no uses listas.
4. PROHIBIDO: No devuelvas tu plan de respuesta o pensamientos internos. Solo el resultado final.
5. Usa Google Search si es necesario información actualizada.`,
        }],
      },
    },
  };

  if (includeTools) setupMessage.setup.tools = [{ googleSearch: {} }];
  return setupMessage;
}
