import { formatCurrentDateForPrompt } from './prompt-date';
import { PROMPT_SECTIONS } from './prompt-sections';

export async function buildSystemPrompt(memoryContext: string = ''): Promise<string> {
  const body = PROMPT_SECTIONS
    .join('\n')
    .replace('{{CURRENT_DATE}}', formatCurrentDateForPrompt());

  return `${body}${memoryContext}`;
}
