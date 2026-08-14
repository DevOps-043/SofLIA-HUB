// Orquestador de la cascada.
//
// Cada aplicacion se resuelve por el PRIMER nivel que entregue contenido util:
//
//   A. documento     COM resuelve la ruta -> el sidecar la lee -> tablas exactas
//   B. accesibilidad UIA TextPattern sobre la ventana        -> texto plano
//   C. captura       imagen de la ventana                    -> solo lo visible
//
// Ningun nivel puede abortar el turno: al fallar o agotar su presupuesto se
// degrada al siguiente. Si ninguno entrega nada, el adjunto vuelve con el aviso
// `sin_texto` y el resto del turno se envia igualmente.

import path from 'node:path';
import { matchDocumentToWindow, type OpenOfficeDocument } from './office-com';
import {
  truncateContextText,
  type DesktopAppContextAttachment,
  type DesktopContextLevel,
  type DesktopContextWarning,
} from './types';
import type { DesktopWindowRecord } from './inventory';
import type { UiaTextResult } from './uia-text';

export interface CascadeDeps {
  availableLevels: DesktopContextLevel[];
  listOfficeDocuments: () => Promise<OpenOfficeDocument[]>;
  /** True si la extension la soporta el sidecar de documentos. */
  isSidecarDocument: (filePath: string) => boolean;
  parseDocument: (filePath: string) => Promise<string>;
  extractWindowText: (pid: number) => Promise<UiaTextResult>;
  captureWindow: (sourceId: string) => Promise<string>;
  fileExists: (filePath: string) => boolean;
}

export async function extractAppContext(
  record: DesktopWindowRecord,
  deps: CascadeDeps,
): Promise<DesktopAppContextAttachment> {
  const fromDocument = await tryDocumentLevel(record, deps);
  if (fromDocument) return fromDocument;

  const fromAccessibility = await tryAccessibilityLevel(record, deps);
  if (fromAccessibility) return fromAccessibility;

  return captureLevel(record, deps);
}

/** Nivel A. Solo para ventanas de Office con documento guardado y legible. */
async function tryDocumentLevel(
  record: DesktopWindowRecord,
  deps: CascadeDeps,
): Promise<DesktopAppContextAttachment | null> {
  if (!deps.availableLevels.includes('documento') || record.expectedLevel !== 'documento') return null;

  const documents = await deps.listOfficeDocuments().catch(() => [] as OpenOfficeDocument[]);
  const match = matchDocumentToWindow(record.title, documents);
  // Sin coincidencia se degrada en lugar de adjuntar el documento equivocado:
  // la Running Object Table devuelve una instancia por ProgID y con dos procesos
  // de Excel independientes puede no ser el libro que el usuario marco.
  if (!match) return null;
  if (!deps.fileExists(match.path) || !deps.isSidecarDocument(match.path)) return null;

  const markdown = await deps.parseDocument(match.path).catch(() => '');
  if (!markdown.trim()) return null;

  const warnings: DesktopContextWarning[] = [];
  // El archivo en disco no refleja lo que el usuario ve. No se descarta el
  // nivel A por eso (sigue siendo lo mas completo), pero se declara para que el
  // modelo no afirme como vigentes unas cifras recien cambiadas sin guardar.
  if (!match.saved) warnings.push('cambios_sin_guardar');

  const attachment = buildAttachment(record, {
    level: 'documento',
    source: path.basename(match.path),
    text: markdown,
    warnings,
  });
  // El sidecar conserva texto y tablas del documento completo. La captura de
  // la vista actual aporta ademas fotografias, diagramas y graficas visibles,
  // que no deben perderse al construir una presentacion. Si falla, el nivel A
  // sigue siendo valido y entrega el documento sin imagen de apoyo.
  const image = await deps.captureWindow(record.sourceId).catch(() => '');
  return image ? { ...attachment, image } : attachment;
}

/** Nivel B. Cualquier aplicacion que exponga texto por accesibilidad. */
async function tryAccessibilityLevel(
  record: DesktopWindowRecord,
  deps: CascadeDeps,
): Promise<DesktopAppContextAttachment | null> {
  if (!deps.availableLevels.includes('accesibilidad')) return null;

  const result = await deps.extractWindowText(record.pid).catch<UiaTextResult>(() => ({ text: '', source: 'error' }));
  if (!result.text.trim()) return null;

  return buildAttachment(record, {
    level: 'accesibilidad',
    source: record.title,
    text: result.text,
    warnings: [],
  });
}

/** Nivel C. Ultimo recurso: lo que se ve en pantalla, y nada mas. */
async function captureLevel(
  record: DesktopWindowRecord,
  deps: CascadeDeps,
): Promise<DesktopAppContextAttachment> {
  const image = await deps.captureWindow(record.sourceId).catch(() => '');
  const attachment = buildAttachment(record, {
    level: 'captura',
    source: record.title,
    text: '',
    warnings: image ? ['solo_visible'] : ['sin_texto'],
  });
  return image ? { ...attachment, image } : attachment;
}

function buildAttachment(
  record: DesktopWindowRecord,
  input: {
    level: DesktopContextLevel;
    source: string;
    text: string;
    warnings: DesktopContextWarning[];
  },
): DesktopAppContextAttachment {
  const { text, truncated } = truncateContextText(input.text);
  const warnings = truncated ? [...input.warnings, 'contenido_truncado' as const] : input.warnings;

  return {
    appId: record.id,
    title: record.title,
    appName: record.appName,
    level: input.level,
    source: input.source,
    text,
    warnings,
    charCount: text.length,
  };
}
