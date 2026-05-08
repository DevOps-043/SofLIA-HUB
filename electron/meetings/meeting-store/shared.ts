import crypto from 'node:crypto';
import type { PostgrestError } from '@supabase/supabase-js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return fallback;
}

export function throwOnError(error: PostgrestError | null, operation: string): void {
  if (!error) return;

  if (/relation .* does not exist/i.test(error.message)) {
    throw new Error(
      `Faltan las tablas de Meeting Ops en IRIS Supabase. Aplica el archivo sql/meeting-ops-tables.sql antes de usar este workflow. Detalle: ${error.message}`,
    );
  }

  throw new Error(`[MeetingStore] ${operation}: ${error.message}`);
}
