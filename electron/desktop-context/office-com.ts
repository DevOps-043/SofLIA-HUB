// Nivel A: COM resuelve RUTAS, nunca lee contenido.
//
// Se consulta la Running Object Table para obtener `FullName` y `Saved` de los
// documentos abiertos, y ahi termina el uso de COM: el contenido lo lee despues
// el sidecar de documentos desde el disco. Recorrer el modelo de objetos de
// Office desde PowerShell seria lento y fragil, y acotar COM a un unico metodo
// de solo lectura hace trivial verificar que este flujo no puede modificar el
// documento del usuario.

import path from 'node:path';
import { DESKTOP_CONTEXT_LIMITS } from './types';
import { parseJsonOutput, runEncodedPowerShell, type EncodedPowerShell } from './powershell';

export interface OpenOfficeDocument {
  /** Ruta absoluta del archivo en disco. */
  path: string;
  /** Nombre del documento tal como lo reporta Office. */
  name: string;
  /** False cuando la ventana tiene cambios que el archivo en disco no refleja. */
  saved: boolean;
}

const LIST_OPEN_OFFICE_DOCUMENTS = `
$ErrorActionPreference = 'SilentlyContinue'
$result = @()
$specs = @(
  @{ prog = 'Word.Application'; coll = 'Documents' },
  @{ prog = 'Excel.Application'; coll = 'Workbooks' },
  @{ prog = 'PowerPoint.Application'; coll = 'Presentations' }
)
foreach ($spec in $specs) {
  $appObj = $null
  try { $appObj = [Runtime.InteropServices.Marshal]::GetActiveObject($spec.prog) } catch { }
  if ($null -eq $appObj) { continue }
  try {
    foreach ($item in $appObj.($spec.coll)) {
      $result += [PSCustomObject]@{
        name  = [string]$item.Name
        path  = [string]$item.FullName
        saved = [bool]$item.Saved
      }
    }
  } catch { }
  try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($appObj) } catch { }
}
ConvertTo-Json -InputObject @($result) -Compress -Depth 3
`;

/** Documentos de Office abiertos ahora mismo, con su ruta y estado de guardado. */
export async function listOpenOfficeDocuments(
  ps: EncodedPowerShell = runEncodedPowerShell,
): Promise<OpenOfficeDocument[]> {
  if (process.platform !== 'win32') return [];
  try {
    const stdout = await ps(LIST_OPEN_OFFICE_DOCUMENTS, DESKTOP_CONTEXT_LIMITS.comTimeoutMs);
    const parsed = parseJsonOutput<OpenOfficeDocument | OpenOfficeDocument[]>(stdout);
    if (!parsed) return [];
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list
      .filter((entry): entry is OpenOfficeDocument => Boolean(entry && typeof entry.path === 'string'))
      .map((entry) => ({
        path: entry.path.trim(),
        name: String(entry.name ?? '').trim(),
        saved: entry.saved !== false,
      }))
      .filter((entry) => path.isAbsolute(entry.path));
  } catch (error) {
    console.warn('[ContextoEscritorio] No se pudieron listar documentos de Office:', toMessage(error));
    return [];
  }
}

/**
 * Empareja un documento abierto con la ventana que el usuario marco.
 *
 * Office titula sus ventanas con el nombre del archivo sin extension
 * ("presupuesto - Excel"), asi que se compara contra el nombre base. Si nada
 * coincide devuelve null y la cascada degrada, en lugar de adjuntar el
 * documento equivocado.
 */
export function matchDocumentToWindow(
  windowTitle: string,
  documents: OpenOfficeDocument[],
): OpenOfficeDocument | null {
  const title = normalize(windowTitle);
  if (!title) return null;

  for (const document of documents) {
    const base = normalize(path.basename(document.path, path.extname(document.path)));
    const full = normalize(path.basename(document.path));
    if (!base) continue;
    if (title.includes(base) || title.includes(full)) return document;
  }
  return null;
}

function normalize(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
