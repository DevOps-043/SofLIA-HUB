import { CHATGPT_OPTIMIZER } from './prompt-optimizer/chatgpt';
import { CLAUDE_OPTIMIZER } from './prompt-optimizer/claude';
import { GEMINI_OPTIMIZER } from './prompt-optimizer/gemini';

export { CHATGPT_OPTIMIZER } from './prompt-optimizer/chatgpt';
export { CLAUDE_OPTIMIZER } from './prompt-optimizer/claude';
export { GEMINI_OPTIMIZER } from './prompt-optimizer/gemini';

export const PROMPT_OPTIMIZER = {
  chatgpt: CHATGPT_OPTIMIZER,
  claude: CLAUDE_OPTIMIZER,
  gemini: GEMINI_OPTIMIZER,
} as const;

export type OptimizerTarget = keyof typeof PROMPT_OPTIMIZER;

export const buildOptimizationPrompt = (
  originalPrompt: string,
  target: OptimizerTarget,
): string => {
  const systemInstruction = PROMPT_OPTIMIZER[target];
  return `${systemInstruction}

PROMPT ORIGINAL (A optimizar):
"${originalPrompt}"

Genera SOLAMENTE el prompt optimizado final:`;
};
