import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, type BrowserWindow, type WebContents } from 'electron';

export const BROWSER_MIN_ZOOM_FACTOR = 0.5;
export const BROWSER_MAX_ZOOM_FACTOR = 3;
export const BROWSER_ZOOM_STEP = 0.1;
export const BROWSER_MAX_FIND_QUERY_CHARS = 500;

export type BrowserZoomAction = 'in' | 'out' | 'reset';

export function nextBrowserZoomFactor(current: number, action: BrowserZoomAction): number {
  if (action === 'reset') return 1;
  const delta = action === 'in' ? BROWSER_ZOOM_STEP : -BROWSER_ZOOM_STEP;
  return clampBrowserZoomFactor(current + delta);
}

export function clampBrowserZoomFactor(value: number): number {
  if (!Number.isFinite(value)) throw new Error('El nivel de zoom es inválido.');
  return Math.round(Math.min(BROWSER_MAX_ZOOM_FACTOR, Math.max(BROWSER_MIN_ZOOM_FACTOR, value)) * 10) / 10;
}

export function validateFindQuery(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('El texto de búsqueda debe ser una cadena.');
  if (raw.length > BROWSER_MAX_FIND_QUERY_CHARS) throw new Error('El texto de búsqueda es demasiado largo.');
  return raw;
}

export async function printBrowserPage(contents: WebContents): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    contents.print({ silent: false, printBackground: true }, (success, failureReason) => {
      if (!success) reject(new Error(failureReason || 'No se pudo imprimir la página.'));
      else resolve();
    });
  });
}

export async function saveBrowserPageAsPdf(
  parent: BrowserWindow,
  contents: WebContents,
  rawTitle: string,
): Promise<{ canceled: boolean; filename?: string }> {
  const title = sanitizePdfName(rawTitle);
  const result = await dialog.showSaveDialog(parent, {
    title: 'Guardar página como PDF',
    defaultPath: `${title}.pdf`,
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const destination = path.extname(result.filePath).toLowerCase() === '.pdf'
    ? result.filePath
    : `${result.filePath}.pdf`;
  const pdf = await contents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  try {
    await fs.writeFile(destination, pdf, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      const wrapped = new Error('El archivo ya existe. Elige otro nombre para evitar sobrescribirlo.');
      Object.defineProperty(wrapped, 'cause', { value: error });
      throw wrapped;
    }
    throw error;
  }
  return { canceled: false, filename: path.basename(destination) };
}

function sanitizePdfName(raw: string): string {
  const cleaned = Array.from(raw.replace(/[<>:"/\\|?*]/g, ' '), (character) => character.charCodeAt(0) <= 31 ? ' ' : character)
    .join('').replace(/\s+/g, ' ').trim().slice(0, 100);
  return cleaned || 'Página';
}
