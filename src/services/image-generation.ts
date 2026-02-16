/**
 * Image Generation Service
 * Uses Gemini 2.5 Flash Image model with multimodal response.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GOOGLE_API_KEY, MODELS } from '../config';
import { getImageGenerationPrompt } from '../prompts/utils';
import { getApiKeyWithCache } from './api-keys';

export interface ImageGenResult {
  text: string;
  imageData?: string;
}

export async function generateImage(prompt: string): Promise<ImageGenResult> {
  const apiKey = (await getApiKeyWithCache('google')) || GOOGLE_API_KEY || '';
  const ai = new GoogleGenerativeAI(apiKey);

  const model = ai.getGenerativeModel({
    model: MODELS.IMAGE_GENERATION,
  });

  const enhancedPrompt = getImageGenerationPrompt(prompt);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    } as any,
  });

  const response = result.response;
  const candidate = response.candidates?.[0];

  let textResponse = '';
  let imageData: string | undefined;

  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts as any[]) {
      if (part.text) textResponse += part.text;
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || 'image/png';
        imageData = `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  return {
    text: textResponse || 'Aqui esta tu imagen generada.',
    imageData,
  };
}
