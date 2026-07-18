import crypto from 'node:crypto';
import type { PostgrestError } from '@supabase/supabase-js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeSdoId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
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

export function throwOnSdoError(error: PostgrestError | null, operation: string): void {
  if (!error) return;

  if (/relation .* does not exist/i.test(error.message)) {
    throw new Error(
      `Faltan las tablas del SDO en la base de SofLIA Hub. Aplica el archivo sql/sdo-tables.sql antes de usar el registro operativo. Detalle: ${error.message}`,
    );
  }

  throw new Error(`[SdoStore] ${operation}: ${error.message}`);
}
