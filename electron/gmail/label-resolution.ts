import type { GmailLabelRecord } from './types';

export function findGmailLabelId(labels: GmailLabelRecord[], query: string): string | null {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return null;

  const found = labels.find(
    (label) => label.id.toLowerCase() === normalized || label.name.toLowerCase() === normalized,
  );
  return found?.id || null;
}

export async function resolveGmailLabelIds(
  labels: string[] | undefined,
  options: { createMissing: boolean },
  deps: {
    getLabels: () => Promise<{ success: boolean; labels?: GmailLabelRecord[]; error?: string }>;
    createLabel: (name: string) => Promise<{ success: boolean; label?: GmailLabelRecord; error?: string }>;
  },
): Promise<string[]> {
  const requested = Array.isArray(labels)
    ? labels.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  if (requested.length === 0) return [];

  const labelsResult = await deps.getLabels();
  if (!labelsResult.success || !labelsResult.labels) {
    throw new Error(labelsResult.error || 'No se pudieron leer las etiquetas de Gmail.');
  }

  const knownLabels = [...labelsResult.labels];
  const resolvedIds: string[] = [];
  for (const requestedLabel of requested) {
    const resolved = findGmailLabelId(knownLabels, requestedLabel);
    if (resolved) {
      resolvedIds.push(resolved);
      continue;
    }
    if (!options.createMissing) {
      console.warn(`[GmailService] Label not found while resolving removeLabels: ${requestedLabel}`);
      continue;
    }
    const created = await deps.createLabel(requestedLabel);
    if (!created.success || !created.label?.id) {
      throw new Error(created.error || `No se pudo crear la etiqueta ${requestedLabel}.`);
    }
    knownLabels.push(created.label);
    resolvedIds.push(created.label.id);
  }

  return resolvedIds;
}
