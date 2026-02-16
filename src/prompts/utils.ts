/**
 * UTILITY PROMPTS
 */

export const getImageGenerationPrompt = (userPrompt: string): string => {
  return `Genera una imagen basada en la siguiente descripción. Sigue estas directrices:
- Calidad profesional, alta resolución y nitidez
- Composición visual equilibrada con buen uso del espacio
- Iluminación natural y colores vibrantes pero realistas
- Estilo coherente con el tema solicitado
- Si no se especifica estilo, usa un estilo fotorrealista moderno

Descripción: ${userPrompt}`;
};
