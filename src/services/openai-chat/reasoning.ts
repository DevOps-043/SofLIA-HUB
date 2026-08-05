import type { ReasoningEffort } from 'openai/resources/shared';

const REASONING_EFFORTS: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * Resuelve exclusivamente niveles visibles del producto. Preferencias de
 * versiones anteriores que permitían omitir razonamiento se elevan a `low`.
 */
export function resolveOpenAIReasoningEffort(params: {
  forced?: unknown;
  selected?: unknown;
}): ReasoningEffort | undefined {
  if (params.forced === 'none' || params.forced === 'minimal') return 'low';
  if (isReasoningEffort(params.forced)) return params.forced;
  if (params.selected === 'none' || params.selected === 'minimal') return 'low';
  return isReasoningEffort(params.selected) ? params.selected : undefined;
}

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && (REASONING_EFFORTS as readonly string[]).includes(value);
}
