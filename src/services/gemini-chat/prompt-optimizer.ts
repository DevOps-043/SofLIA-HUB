import { MODELS } from '../../config';
import { getGenAI } from './client';

export async function optimizePrompt(
  originalPrompt: string,
  target: 'chatgpt' | 'claude' | 'gemini',
): Promise<string> {
  const { buildOptimizationPrompt } = await import('../../prompts/prompt-optimizer');
  const ai = await getGenAI();
  const model = ai.getGenerativeModel({ model: MODELS.PRO });
  const prompt = buildOptimizationPrompt(originalPrompt, target);
  const result = await model.generateContent(prompt);
  return result.response.text();
}
