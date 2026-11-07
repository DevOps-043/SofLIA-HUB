import { generateAssistantText } from '../openai-chat/generate-text';

export async function optimizePrompt(
  originalPrompt: string,
  target: 'chatgpt' | 'claude',
): Promise<string> {
  const { buildOptimizationPrompt } = await import('../../prompts/prompt-optimizer');
  return generateAssistantText({ prompt: buildOptimizationPrompt(originalPrompt, target) });
}
