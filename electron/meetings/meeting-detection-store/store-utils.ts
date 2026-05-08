import type { PostgrestError } from '@supabase/supabase-js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeDetectionId(prefix: string, randomUUID: () => string): string {
  return `${prefix}_${randomUUID()}`;
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
  return typeof value === 'object' ? value as T : fallback;
}

export function throwOnDetectionStoreError(error: PostgrestError | null, operation: string): void {
  if (!error) return;
  if (/relation .* does not exist/i.test(error.message)) {
    throw new Error(
      `Faltan las tablas actualizadas de Meeting Ops en IRIS Supabase. Vuelve a ejecutar sql/meeting-ops-tables.sql. Detalle: ${error.message}`,
    );
  }
  throw new Error(`[MeetingDetectionStore] ${operation}: ${error.message}`);
}
