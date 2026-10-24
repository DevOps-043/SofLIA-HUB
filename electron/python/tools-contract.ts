import { z } from 'zod';
import { PYTHON_TOOLS_MAX_CELLS, PYTHON_TOOLS_MAX_TABLES, PYTHON_TOOLS_MAX_TEXT_CHARS, type ParsedDocument, type PiiEntity, type RedactionResult } from '../../src/shared/python-tools';

export interface PythonToolsOperationContext { assertCurrent(): void; signal?: AbortSignal }
export function assertToolsOperation(context?: PythonToolsOperationContext): void {
  context?.assertCurrent(); if (context?.signal?.aborted) throw new Error('TOOLS_CANCELLED');
}
export function validateToolsText(text: unknown): asserts text is string {
  if (typeof text !== 'string' || text.length > PYTHON_TOOLS_MAX_TEXT_CHARS || text.includes('\0')) throw new Error('TOOLS_INVALID_INPUT');
}
const engine = z.string().min(1).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/u);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const position = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const tableSchema = z.object({ rows: z.array(z.array(z.string().max(PYTHON_TOOLS_MAX_TEXT_CHARS)).max(200)).max(2000),
  page: position.optional(), sheet: z.string().max(512).optional(), slide: position.optional(), index: count.optional() });
const metadataSchema = z.object({ pages: count.optional(), pagesParsed: count.optional(), sheets: count.optional(), slides: count.optional(),
  paragraphs: count.optional(), tables: count.optional(), format: z.enum(['pdf', 'xlsx', 'xlsm', 'pptx', 'docx']).optional(),
  sizeBytes: count.optional(), truncated: z.boolean().optional(), piiRedacted: count.optional(), piiEngine: engine.optional() });
const documentSchema = z.object({ markdown: z.string().max(PYTHON_TOOLS_MAX_TEXT_CHARS), tables: z.array(tableSchema).max(PYTHON_TOOLS_MAX_TABLES), metadata: metadataSchema });

/** Presupuesto previo a la copia/validación profunda; campos desconocidos no salen de main. */
export function projectDocument(value: unknown, redact: boolean): ParsedDocument {
  const input = value as Partial<ParsedDocument> | null;
  if (!input || !Array.isArray(input.tables) || input.tables.length > PYTHON_TOOLS_MAX_TABLES) throw new Error('TOOLS_INVALID_RESPONSE');
  let cells = 0; let characters = 0;
  for (const table of input.tables) {
    if (!table || !Array.isArray(table.rows) || table.rows.length > 2000) throw new Error('TOOLS_INVALID_RESPONSE');
    for (const row of table.rows) {
      if (!Array.isArray(row) || row.length > 200 || (cells += row.length) > PYTHON_TOOLS_MAX_CELLS) throw new Error('TOOLS_INVALID_RESPONSE');
      for (const cell of row) { if (typeof cell !== 'string' || (characters += cell.length) > PYTHON_TOOLS_MAX_TEXT_CHARS) throw new Error('TOOLS_INVALID_RESPONSE'); }
    }
  }
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success || redact && (parsed.data.metadata.piiRedacted === undefined || !parsed.data.metadata.piiEngine)) throw new Error('TOOLS_INVALID_RESPONSE');
  return parsed.data;
}
const entitySchema = z.object({ type: z.enum(['CURP', 'RFC', 'CLABE', 'IBAN', 'EMAIL', 'TARJETA', 'TELEFONO']), start: count, end: count });
export function projectPii(value: unknown, text: string): { entities: PiiEntity[]; engine: string } {
  const entities = (value as { entities?: unknown } | null)?.entities;
  if (!Array.isArray(entities) || entities.length > 20_000) throw new Error('TOOLS_INVALID_RESPONSE');
  const parsed = z.object({ entities: z.array(entitySchema).max(20_000), engine }).safeParse(value);
  if (!parsed.success) throw new Error('TOOLS_INVALID_RESPONSE');
  let end = 0; let length = 0; let cursor = 0;
  while (cursor < text.length) { cursor += text.codePointAt(cursor)! > 0xffff ? 2 : 1; length++; }
  for (const item of parsed.data.entities) {
    if (item.start < end || item.end <= item.start || item.end > length) throw new Error('TOOLS_INVALID_RESPONSE'); end = item.end;
  }
  return parsed.data;
}
export function projectRedaction(value: unknown, text: string): RedactionResult {
  const parsed = z.object({ redacted: z.string().max(PYTHON_TOOLS_MAX_TEXT_CHARS), redactedCount: count }).safeParse(value);
  if (!parsed.success) throw new Error('TOOLS_INVALID_RESPONSE');
  const pii = projectPii(value, text);
  if (parsed.data.redactedCount !== pii.entities.length) throw new Error('TOOLS_INVALID_RESPONSE');
  return { ...pii, ...parsed.data };
}

const MESSAGES: Record<string, string> = {
  SIDECAR_UNAVAILABLE: 'El runtime Python no está instalado. Ejecuta "npm run python:setup" o reinstala la app.',
  SIDECAR_STOP_UNCONFIRMED: 'No se pudo confirmar el cierre del lector local. Reinicia la aplicación antes de volver a leer.',
  DOC_NOT_FOUND: 'No se encontró el documento seleccionado.', DOC_TOO_LARGE: 'El documento supera el límite de lectura local.',
  DOC_UNSUPPORTED: 'El formato del documento no está admitido.', DOC_ENCRYPTED: 'El documento está protegido con contraseña.',
  DOC_RESOURCE_LIMIT: 'El documento supera el presupuesto de lectura local. Selecciona un documento menor.',
  DOC_SCANNED: 'El PDF no tiene texto seleccionable. Requiere OCR.', DOC_PARSE_FAILED: 'No se pudo interpretar el documento.',
  DEPENDENCY_MISSING: 'Falta una dependencia del lector local. Revisa el runtime Python.',
  DEPENDENCY_INCOMPATIBLE: 'El lector local necesita dependencias verificadas actualizadas. Vuelve a preparar el runtime.',
  TOOLS_INVALID_INPUT: 'La solicitud de lectura o redacción no es válida.', TOOLS_INVALID_RESPONSE: 'El lector devolvió una respuesta fuera de contrato.',
  PRIVACY_CHANGED: 'La política de privacidad cambió. Vuelve a solicitar la lectura.', TOOLS_CANCELLED: 'La lectura o redacción fue cancelada.',
  TIMEOUT: 'El lector local agotó el tiempo de respuesta.', SIDECAR_STOPPED: 'El lector local fue detenido.',
  SIDECAR_START_FAILED: 'No se pudo iniciar el lector local. Revisa el runtime Python.',
  SIDECAR_CRASHED: 'El lector local finalizó inesperadamente.', SIDECAR_PROTOCOL_ERROR: 'El lector local emitió datos incompatibles.',
  SIDECAR_WRITE_FAILED: 'Falló la comunicación con el lector local.', SIDECAR_BUSY: 'El lector local no puede aceptar más trabajo.',
  PRIVACY_CONFIG_INVALID: 'La configuración de privacidad no es válida.', PRIVACY_WRITE_FAILED: 'No se pudo confirmar el guardado de privacidad. Revisa el estado antes de continuar.',
  DOCUMENT_CHANGED: 'El documento cambió mientras se preparaba su lectura. Vuelve a seleccionarlo.', DOCUMENT_NOT_ALLOWED: 'El documento supera el límite o su formato no está admitido.',
  DOCUMENT_CLEANUP_PENDING: 'No se confirmó la limpieza de una copia temporal. Revisa el lector antes de continuar.',
  approval_cancelled: 'El cambio de privacidad fue cancelado.', approval_pending: 'Hay una revisión de privacidad pendiente.', approval_expired: 'La revisión de privacidad venció.',
};
export function toolsFailure(code: unknown) {
  const safeCode = typeof code === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, code) ? code : 'TOOLS_FAILED';
  return { success: false as const, error: { code: safeCode, message: MESSAGES[safeCode] ?? 'No se pudo completar la operación del lector local.', recoverable: true } };
}
