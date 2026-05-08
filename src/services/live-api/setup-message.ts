import { MODELS } from '../../config';

export function buildSetupMessage(includeTools: boolean): any {
  const setupMessage: any = {
    setup: {
      model: `models/${MODELS.LIVE}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
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
