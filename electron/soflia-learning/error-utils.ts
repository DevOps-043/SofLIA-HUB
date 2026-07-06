import type { SofliaLearningRepositoryError } from './types';

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST106', 'PGRST200', 'PGRST205']);

export function sanitizeSofliaLearningError(input: unknown): string {
  const raw = input instanceof Error ? input.message : String(input || 'Error desconocido');
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(apikey|api_key|service_role|token|secret)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[jwt-redacted]')
    .slice(0, 500);
}

export function isMissingTableError(error: any): boolean {
  if (!error) {
    return false;
  }

  const code = String(error.code || '');
  if (MISSING_TABLE_CODES.has(code)) {
    return true;
  }

  const text = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  return /relation .* does not exist|could not find .* table|not found in the schema|schema cache/i.test(text);
}

export function toRepositoryError(error: any, table: string): SofliaLearningRepositoryError {
  if (isMissingTableError(error)) {
    return {
      code: 'missing_table',
      table,
      message: `La tabla ${table} no existe en SofLIA Learning o no esta expuesta por la API.`,
    };
  }

  return {
    code: 'query_failed',
    table,
    message: sanitizeSofliaLearningError(error?.message || error),
  };
}

