import { VIEWER_LIMITS, type ArtifactPreview, type ViewerFile, type ViewerSheet } from '../../src/shared/artifact-viewer';
import { assertOfficeLimits } from './office-limits';
import { readPresentationSlides } from '../background-teams/presentation-reader';
import { normalizeDocumentLogo } from '../organization-branding/document-logo';
import { applyDocumentTheme } from './document-theme';

const imageTypes: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
function textPreview(file: ViewerFile, text: string, kind: 'markdown' | 'text' | 'html' | 'document'): ArtifactPreview {
  return { ...file, content: { kind, text: text.slice(0, VIEWER_LIMITS.textChars), truncated: text.length > VIEWER_LIMITS.textChars } };
}
function cellText(value: import('exceljs').CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return String(value).slice(0, 2000);
  if ('richText' in value) return value.richText.map(part => part.text).join('').slice(0, 2000);
  if ('formula' in value || 'sharedFormula' in value) return value.result == null ? 'Sin valor calculado' : String(value.result).slice(0, 2000);
  if ('text' in value) return String(value.text).slice(0, 2000);
  return 'error' in value ? value.error : '';
}

export async function readArtifactPreview(file: ViewerFile, buffer: Buffer): Promise<ArtifactPreview> {
  const extension = file.extension;
  if (['docx', 'xlsx', 'pptx'].includes(extension)) assertOfficeLimits(buffer);
  if (extension === 'pdf') {
    if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('El archivo no es un PDF válido.');
    return { ...file, content: { kind: 'pdf', base64: buffer.toString('base64'), mime: 'application/pdf' } };
  }
  if (imageTypes[extension]) {
    const sharp = (await import('sharp')).default;
    // Decodificar en main valida el contenido y elimina metadatos; el renderer recibe una imagen acotada.
    const image = await sharp(buffer, { limitInputPixels: 40_000_000 }).resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return { ...file, content: { kind: 'image', base64: image.toString('base64'), mime: 'image/png' } };
  }
  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    let imageBudget = 65_536;
    let imageCount = 0;
    const result = await mammoth.convertToHtml({ buffer }, { externalFileAccess: false, convertImage: mammoth.images.imgElement(async image => {
      // Reservar antes del await evita decodificaciones ilimitadas en paralelo.
      if (imageBudget <= 0 || ++imageCount > 8) return { src: '' };
      try {
        const bytes = await image.readAsBuffer();
        if (bytes.length > 2_097_152) return { src: '' };
        const normalized = await normalizeDocumentLogo(bytes); imageBudget -= normalized.png.length;
        return imageBudget >= 0 ? { src: 'data:image/png;base64,' + Buffer.from(normalized.png).toString('base64') } : { src: '' };
      } catch { return { src: '' }; }
    }), styleMap: [
      "p[style-name='Title'] => h1.document-title:fresh",
      "p[style-name='Subtitle'] => p.document-subtitle:fresh",
      "p[style-name='SofLIA Metadata'] => p.document-meta:fresh",
      "p[style-name='SofLIA Logo'] => p.document-logo:fresh",
    ] });
    return textPreview(file, await applyDocumentTheme(buffer, result.value), 'document');
  }
  if (extension === 'pptx') return { ...file, content: { kind: 'slides', slides: readPresentationSlides(buffer) } };
  if (extension === 'xlsx' || extension === 'csv') {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    if (extension === 'xlsx') await workbook.xlsx.load(buffer as never);
    else {
      const { Readable } = await import('node:stream');
      await workbook.csv.read(Readable.from([buffer]), { parserOptions: { delimiter: detectCsvDelimiter(buffer.toString('utf8', 0, 4096)), maxRows: VIEWER_LIMITS.rows + 1 } });
    }
    let budget = VIEWER_LIMITS.cells as number;
    const sheets: ViewerSheet[] = workbook.worksheets.slice(0, VIEWER_LIMITS.sheets).map(sheet => {
      const rows: string[][] = [];
      const columns = Math.min(sheet.columnCount, VIEWER_LIMITS.columns);
      const count = Math.min(sheet.rowCount, VIEWER_LIMITS.rows, Math.floor(budget / Math.max(1, columns)));
      for (let row = 1; row <= count; row++) {
        rows.push(Array.from({ length: columns }, (_, index) => cellText(sheet.getCell(row, index + 1).value)));
      }
      budget -= count * columns;
      return { name: sheet.name, rows, truncated: count < sheet.rowCount || columns < sheet.columnCount };
    });
    return { ...file, content: { kind: 'spreadsheet', sheets, truncated: workbook.worksheets.length > sheets.length || sheets.some(sheet => sheet.truncated) } };
  }
  const text = buffer.toString('utf8');
  if (text.includes('\u0000')) throw new Error('El archivo contiene datos binarios inesperados.');
  return textPreview(file, text, extension === 'md' ? 'markdown' : ['html', 'htm'].includes(extension) ? 'html' : 'text');
}
function detectCsvDelimiter(text: string): string {
  let quoted = false; let commas = 0; let semicolons = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (char === '\r' || char === '\n') break;
      if (char === ',') commas++;
      if (char === ';') semicolons++;
    }
  }
  return semicolons > commas ? ';' : ',';
}
