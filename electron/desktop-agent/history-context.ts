import type { ActionHistoryEntry, DesktopAgentConfig } from '../desktop-agent-types';

function hasPromptValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function buildHistoryContext(
  actionHistory: ActionHistoryEntry[],
  config: DesktopAgentConfig,
): string {
  const windowSize = config.maxRawHistorySteps || config.memoryWindowSize;
  const recent = actionHistory.slice(-windowSize);

  return recent.map(entry => {
    const action = entry.action;
    const element = hasPromptValue(action.elementId) ? ` [elem ${action.elementId}]` : '';
    const point = hasPromptValue(action.x) ? ` (${action.x},${action.y})` : '';
    const text = hasPromptValue(action.text) ? ` "${action.text}"` : '';
    const key = hasPromptValue(action.key) ? ` [${action.key}]` : '';
    const verification = entry.verificationFailed ? ' VERIFICACION_FALLO' : '';
    const result = entry.success ? 'ok' : 'fallo';

    return `  Paso ${entry.step + 1}: ${action.action}${element}${point}${text}${key} - ${result}${verification} ${action.message}`;
  }).join('\n');
}
