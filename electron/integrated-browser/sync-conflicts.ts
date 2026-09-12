import { createHash } from 'node:crypto';
import type { BrowserSyncCategory } from './platform-types';
import { normalizeBrowserSyncInput, type BrowserSyncPayload, type BrowserSyncRecord } from './sync-crypto';

export interface BrowserSyncMergeInput {
  category: BrowserSyncCategory;
  baseRevision: number;
  remoteRevision: number;
  base: BrowserSyncPayload;
  local: BrowserSyncPayload;
  remote: BrowserSyncPayload;
}

type Slot = { present: false } | { present: true; value: unknown };
export interface BrowserSyncConflict {
  id: string;
  kind: 'field' | 'delete-edit' | 'id-collision' | 'quota';
  recordId: string | null;
  field: string | null;
  base: Slot;
  local: Slot;
  remote: Slot;
}
export interface BrowserSyncConflictChoice { conflictId: string; side: 'local' | 'remote' }
export interface BrowserSyncMergeResult {
  reviewId: string;
  category: BrowserSyncCategory;
  baseRevision: number;
  remoteRevision: number;
  status: 'ready' | 'conflict';
  payload: BrowserSyncPayload | null;
  conflicts: BrowserSyncConflict[];
  unresolved: number;
}

function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function equal(a: unknown, b: unknown): boolean { return canonical(a) === canonical(b); }
function slot(value: unknown): Slot { return value === undefined ? { present: false } : { present: true, value }; }
function fieldSlot(row: BrowserSyncRecord | undefined, key: string): Slot {
  return row && Object.prototype.hasOwnProperty.call(row, key) ? slot(row[key]) : { present: false };
}

function normalizePayload(category: BrowserSyncCategory, raw: unknown): BrowserSyncPayload {
  const payload = normalizeBrowserSyncInput({ category, payload: raw }).payload;
  const normalizeRow = (row: BrowserSyncRecord): BrowserSyncRecord => {
    const result: BrowserSyncRecord = {};
    for (const key of Object.keys(row).sort()) result[key] = key === 'tags' ? [...new Set(row[key] as string[])].sort() : row[key];
    return result;
  };
  if (!Array.isArray(payload)) return normalizeRow(payload);
  return payload.map(normalizeRow).sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)
    || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
}

export function normalizeBrowserSyncMergeInput(raw: unknown): BrowserSyncMergeInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('La revisión de sincronización es inválida.');
  const input = raw as BrowserSyncMergeInput;
  const fields = ['category', 'baseRevision', 'remoteRevision', 'base', 'local', 'remote'];
  if (Object.keys(raw).length !== fields.length || Object.keys(raw).some((key) => !fields.includes(key))
    || !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0
    || !Number.isSafeInteger(input.remoteRevision) || input.remoteRevision <= input.baseRevision) {
    throw new Error('La revisión de sincronización es inválida.');
  }
  return {
    category: input.category, baseRevision: input.baseRevision, remoteRevision: input.remoteRevision,
    base: normalizePayload(input.category, input.base), local: normalizePayload(input.category, input.local), remote: normalizePayload(input.category, input.remote),
  };
}

/** Tres vías con base explícita. Nunca publica un payload parcialmente resuelto. */
export function reconcileBrowserSync(raw: unknown, choices: readonly BrowserSyncConflictChoice[] = []): BrowserSyncMergeResult {
  const input = normalizeBrowserSyncMergeInput(raw);
  const reviewId = createHash('sha256').update(canonical(input)).digest('hex');
  if (!Array.isArray(choices) || choices.length > 100_000) throw new Error('Las decisiones de sincronización son inválidas.');
  const selected = new Map<string, 'local' | 'remote'>();
  for (const choice of choices) {
    if (!choice || Object.keys(choice).length !== 2 || typeof choice.conflictId !== 'string'
      || !['local', 'remote'].includes(choice.side) || selected.has(choice.conflictId)) throw new Error('Las decisiones de sincronización son inválidas.');
    selected.set(choice.conflictId, choice.side);
  }
  const conflicts: BrowserSyncConflict[] = [];
  const choose = (kind: BrowserSyncConflict['kind'], recordId: string | null, field: string | null, base: Slot, local: Slot, remote: Slot): Slot => {
    const id = createHash('sha256').update(canonical([reviewId, kind, recordId, field])).digest('hex');
    conflicts.push({ id, kind, recordId, field, base, local, remote });
    return selected.get(id) === 'remote' ? remote : local;
  };
  const mergeRow = (id: string | null, base: BrowserSyncRecord | undefined, local: BrowserSyncRecord, remote: BrowserSyncRecord): BrowserSyncRecord => {
    const result: BrowserSyncRecord = {};
    const fields = [...new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remote)])].sort();
    for (const field of fields) {
      const b = fieldSlot(base, field), l = fieldSlot(local, field), r = fieldSlot(remote, field);
      let value: Slot;
      if (equal(l, r)) value = l;
      else if (equal(l, b)) value = r;
      else if (equal(r, b)) value = l;
      else if (field === 'tags' && b.present && l.present && r.present) {
        const before = new Set(b.value as string[]), left = new Set(l.value as string[]), right = new Set(r.value as string[]);
        const merged = [...new Set([...left, ...right])].filter((tag) => !before.has(tag) || (left.has(tag) && right.has(tag))).sort();
        value = merged.length <= 20 ? slot(merged) : choose('field', id, field, b, l, r);
      } else value = choose('field', id, field, b, l, r);
      if (value.present) result[field] = value.value as BrowserSyncRecord[string];
    }
    return result;
  };
  let candidate: BrowserSyncPayload;
  if (input.category === 'settings') {
    candidate = mergeRow(null, input.base as BrowserSyncRecord, input.local as BrowserSyncRecord, input.remote as BrowserSyncRecord);
  } else {
    const index = (rows: BrowserSyncPayload) => new Map((rows as BrowserSyncRecord[]).map((row) => [String(row.id), row]));
    const base = index(input.base), local = index(input.local), remote = index(input.remote);
    const ids = [...new Set([...base.keys(), ...local.keys(), ...remote.keys()])].sort();
    candidate = [];
    for (const id of ids) {
      const b = base.get(id), l = local.get(id), r = remote.get(id);
      let value: Slot;
      if (equal(l, r)) value = slot(l);
      else if (equal(l, b)) value = slot(r);
      else if (equal(r, b)) value = slot(l);
      else if (!l || !r) value = choose('delete-edit', id, null, slot(b), slot(l), slot(r));
      else if (!b) value = choose('id-collision', id, null, slot(b), slot(l), slot(r));
      else value = slot(mergeRow(id, b, l, r));
      if (value.present) candidate.push(value.value as BrowserSyncRecord);
    }
  }
  try { candidate = normalizePayload(input.category, candidate); }
  catch {
    // La unión puede exceder la cuota aunque cada instantánea sea válida.
    conflicts.length = 0;
    const value = choose('quota', null, null, slot(input.base), slot(input.local), slot(input.remote));
    candidate = (value as { present: true; value: BrowserSyncPayload }).value;
  }
  const conflictIds = new Set(conflicts.map((conflict) => conflict.id));
  if ([...selected.keys()].some((id) => !conflictIds.has(id))) throw new Error('La decisión no pertenece a esta revisión de sincronización.');
  const unresolved = conflicts.filter((conflict) => !selected.has(conflict.id)).length;
  return {
    reviewId, category: input.category, baseRevision: input.baseRevision, remoteRevision: input.remoteRevision,
    status: unresolved ? 'conflict' : 'ready', payload: unresolved ? null : candidate, conflicts, unresolved,
  };
}
