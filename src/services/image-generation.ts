/**
 * Image Generation Service
 * Generación de imágenes mediante el proveedor OpenAI del proceso principal.
 */

import { getDirectedImagePrompt, getImageGenerationPrompt } from '../prompts/utils';
import { getPublicAiErrorMessage } from './gemini-chat/public-error';
import { generateNativeImage } from './image-generation-api';

export interface ImageGenResult {
  text: string;
  imageData?: string;
}

export async function generateImage(
  prompt: string,
  options: { artDirection?: string } = {},
): Promise<ImageGenResult> {
  // Con direccion de arte propia se omite el envoltorio general, que empuja a
  // fotorrealismo y rompe la coherencia de una serie ilustrada.
  const enhancedPrompt = options.artDirection
    ? getDirectedImagePrompt(prompt, options.artDirection)
    : getImageGenerationPrompt(prompt);

  try {
    const native = await generateNativeImage(enhancedPrompt);
    return native.success ? { text: native.text, ...(native.imageData ? { imageData: native.imageData } : {}) } : { text: native.error };
  } catch (error: unknown) {
    console.error('[Generación de imagen] La solicitud falló.');
    return {
      text: getPublicAiErrorMessage(error, {
        rateLimit: 'No pude generar la imagen por capacidad temporal. Intenta de nuevo en unos segundos.',
        timeout: 'La generacion de imagen tardo mas de lo esperado. Intenta de nuevo en unos segundos.',
        safety: 'No pude generar esa imagen de forma segura. Ajusta la solicitud y vuelvo a intentarlo.',
        generic: 'No pude generar la imagen en este momento. Intenta de nuevo.',
      }),
    };
  }
}
