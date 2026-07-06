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
    const target = describeResolvedTarget(entry);
    const result = entry.success ? 'ok' : 'fallo';

    return `  Paso ${entry.step + 1}: ${action.action}${element}${point}${text}${key} - ${result}${verification}${target} ${action.message}`;
  }).join('\n');
}

function describeResolvedTarget(entry: ActionHistoryEntry): string {
  if (!entry.resolvedTarget) return '';
  const target = entry.resolvedTarget;
  const img = target.centroImagen ? ` img(${Math.round(target.centroImagen.x)},${Math.round(target.centroImagen.y)})` : '';
  const text = target.text ? ` "${target.text}"` : '';
  const retryWarning = entry.verificationFailed ? ' NO_REPETIR_TARGET' : '';
  return ` target=${target.kind}${text}${img}${retryWarning}`;
}
