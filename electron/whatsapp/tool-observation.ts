/** Campos de diagnóstico; nunca argumentos, mensajes, rutas ni IDs de recursos. */
const flags = ['success', 'partial', 'uncertain', 'recoveryRequired', 'cancelled', 'conflict', 'sourceEmpty', 'remainingLabelsVerified', 'labelDeleted'] as const;
const counters = ['count', 'processed', 'remaining', 'effectsConfirmed', 'labelsProcessed', 'labelsDeleted', 'totalMessagesMovedToInbox',
  'groupsApplied', 'messagesLabeled', 'messagesRestored', 'labelsRetained', 'labelsCreatedCount', 'errorCount'] as const;
const states = new Set(['pending', 'running', 'queued', 'completed', 'failed', 'cancelled', 'partial', 'waiting', 'stopped', 'done', 'error', 'success', 'active', 'idle']);
type Flag = typeof flags[number];
type Counter = typeof counters[number];
export type ToolObservation = { name: string; hasError?: boolean; status?: string; session_status?: string;
  errorCode?: 'TOOL_GUARD_FAILED' | 'TOOL_EXECUTION_FAILED'; correlationId?: string }
  & Partial<Record<Flag, boolean>> & Partial<Record<Counter, number>>;
export const TOOL_OBSERVATION_LIMIT = 30;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const safeToolName = (value: unknown): string => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/.test(value) ? value : 'herramienta_desconocida';
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const correlation = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function observeToolResult(name: unknown, input: unknown): ToolObservation {
  const result = record(input), output: ToolObservation = { name: safeToolName(name) };
  for (const key of flags) if (typeof result[key] === 'boolean') output[key] = result[key];
  for (const key of counters) if (count(result[key])) output[key] = result[key];
  for (const key of ['status', 'session_status'] as const) if (typeof result[key] === 'string' && states.has(result[key])) output[key] = result[key];
  if (typeof result.error === 'string' || result.hasError === true || (Array.isArray(result.errors) && result.errors.length > 0)) output.hasError = true;
  if (Array.isArray(result.labelsCreated)) output.labelsCreatedCount = result.labelsCreated.length;
  if (Array.isArray(result.errors)) output.errorCount = result.errors.length;
  if (result.errorCode === 'TOOL_GUARD_FAILED' || result.errorCode === 'TOOL_EXECUTION_FAILED') output.errorCode = result.errorCode;
  if (correlation(result.correlationId)) output.correlationId = result.correlationId;
  return output;
}
export function observeToolSummary(input: unknown): ToolObservation[] {
  return Array.isArray(input) ? input.slice(0, TOOL_OBSERVATION_LIMIT).map(value => {
    const item = record(value); return observeToolResult(item.name, item);
  }) : [];
}
export function observeToolNames(input: unknown): string[] {
  return Array.isArray(input) ? input.slice(0, TOOL_OBSERVATION_LIMIT).map(safeToolName) : [];
}
export function toolHistoryMetadata(input: unknown): Record<string, unknown> {
  const metadata = record(input), output: Record<string, unknown> = {};
  if (correlation(metadata.correlationId)) output.correlationId = metadata.correlationId;
  if (count(metadata.durationMs)) output.durationMs = metadata.durationMs;
  return output;
}
