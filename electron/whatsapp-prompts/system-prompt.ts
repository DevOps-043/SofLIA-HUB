import { formatCurrentDateForPrompt } from './prompt-date';
import { PROMPT_SECTIONS } from './prompt-sections';

export interface BuildSystemPromptOptions {
  agentName?: string;
}

export async function buildSystemPrompt(
  memoryContext: string = '',
  options: BuildSystemPromptOptions = {},
): Promise<string> {
  const agentName = normalizeAgentName(options.agentName);
  const body = PROMPT_SECTIONS
    .join('\n')
    .replace(/\{\{CURRENT_DATE\}\}/g, formatCurrentDateForPrompt())
    .replace(/\{\{AGENT_NAME\}\}/g, () => agentName);

  return `${body}${memoryContext}`;
}

function normalizeAgentName(value: unknown): string {
  const name = String(value || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 60);
  return name || 'Pulse';
}
