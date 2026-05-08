import type { GeminiSchemaNode } from './types';

export function normalizeGeminiSchemaNode(node: any): GeminiSchemaNode {
  if (!node || typeof node !== 'object') return { type: 'STRING' };

  const normalized: Record<string, any> = { ...node };
  if (typeof normalized.type === 'string') normalized.type = normalized.type.toUpperCase();
  if (normalized.properties && typeof normalized.properties === 'object') {
    const nextProps: Record<string, any> = {};
    for (const [key, value] of Object.entries(normalized.properties)) {
      nextProps[key] = normalizeGeminiSchemaNode(value);
    }
    normalized.properties = nextProps;
  }
  if (normalized.items) normalized.items = normalizeGeminiSchemaNode(normalized.items);
  return normalized;
}
