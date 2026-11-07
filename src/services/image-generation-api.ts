import type { ImageGenerationApi, ImageGenerationReply } from '../shared/image-generation';
declare global { interface Window { imageGeneration?: ImageGenerationApi } }
/** null indica navegador autónomo; Electron sin bridge falla cerrado. */
export async function generateNativeImage(prompt: string): Promise<ImageGenerationReply> {
  if (window.imageGeneration) return window.imageGeneration.generate(prompt);
  if ('ipcRenderer' in window) throw new Error('Generación de imagen nativa no disponible.');
  throw new Error('La generación de imágenes requiere la aplicación de escritorio.');
}
