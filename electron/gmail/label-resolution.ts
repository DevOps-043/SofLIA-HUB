import type { GmailLabelRecord } from './types';

export function findGmailLabelId(labels: GmailLabelRecord[], query: string): string | null {
  const normalized = query.trim().toLowerCase();
  const found = labels.filter(label => label.id === query || label.name.toLowerCase() === normalized);
  if (found.length > 1) throw new Error('Referencia de etiqueta ambigua.');
  return found[0]?.id ?? null;
}
export interface PreparedGmailLabels {
  add: Array<{ id?: string; name: string }>;
  remove: string[];
  create: string[];
}
/** Resuelve todo antes de crear una etiqueta; una referencia inválida no deja efectos. */
export function prepareGmailLabels(labels: GmailLabelRecord[], add: string[] = [], remove: string[] = []): PreparedGmailLabels {
  const changes: PreparedGmailLabels = { add: [], remove: [], create: [] };
  for (const reference of remove) {
    const id = findGmailLabelId(labels, reference);
    if (!id) throw new Error('La etiqueta a quitar no existe.');
    if (!changes.remove.includes(id)) changes.remove.push(id);
  }
  for (const name of add) {
    const id = findGmailLabelId(labels, name);
    if (id && changes.remove.includes(id)) throw new Error('Una etiqueta no puede añadirse y quitarse a la vez.');
    if (changes.add.some(ref => id ? ref.id === id : !ref.id && ref.name.toLowerCase() === name.toLowerCase())) continue;
    changes.add.push({ id: id ?? undefined, name });
    if (!id) changes.create.push(name);
  }
  return changes;
}
