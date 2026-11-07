/** Contrato limitado para generación de imágenes en el proceso principal. */
export const OPENAI_IMAGE_MODEL = 'gpt-image-2.6-flare';
export const IMAGE_MAX_PROMPT = 120_000;
export type ImageGenerationReply = { success: true; text: string; imageData?: string } | { success: false; error: string };
export interface ImageGenerationApi { generate(prompt: string): Promise<ImageGenerationReply> }
