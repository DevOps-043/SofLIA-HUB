/**
 * Handler del tool `create_document`.
 *
 * Genera documentos profesionales en distintos formatos. Cada formato delega
 * a un módulo especializado:
 *  - **word/docx** → `document-designer.createProfessionalDocument`
 *  - **excel/xlsx** → genera vía `exceljs` con auto-fit de columnas
 *  - **md/markdown** → escribe directamente con prefijo de título
 *  - **pdf** → renderiza HTML en `BrowserWindow` offscreen + printToPDF
 *  - **pptx/powerpoint/presentacion** → `presentation-premium.createPresentationPDF`
 *    (con fallback a `presentation-pdf` si el módulo premium no está disponible)
 *
 * Resuelve el directorio de salida automáticamente si no se especifica
 * (prefiere `OneDrive/Escritorio` sobre `Desktop` cuando existe).
 */

import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';

const TOOL_NAME = 'create_document';

async function resolveSaveDirectory(requested: string): Promise<string> {
  if (requested) return requested;

  const home = os.homedir();
  const oneDriveDesktop = path.join(home, 'OneDrive', 'Escritorio');
  try {
    await fs.access(oneDriveDesktop);
    return oneDriveDesktop;
  } catch {
    return path.join(home, 'Desktop');
  }
}

async function createWordDocument(args: {
  content: string;
  title: string;
  saveDir: string;
  filename: string;
}): Promise<string> {
  const { createProfessionalDocument } = await import('../../document-designer');
  const filePath = path.join(args.saveDir, `${args.filename}.docx`);
  await createProfessionalDocument({
    content: args.content,
    title: args.title,
    author: 'SofLIA',
    outputPath: filePath,
    type: 'word',
    includeCover: true,
  });
  return filePath;
}

async function createExcelDocument(args: {
  content: string;
  title: string;
  saveDir: string;
  filename: string;
}): Promise<string> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  const sheet = workbook.addWorksheet(args.title.slice(0, 31)); // Excel max 31 chars

  let rows: Array<Record<string, unknown>>;
  try {
    rows = JSON.parse(args.content);
  } catch {
    // Fallback: una columna "Contenido" con cada línea no vacía.
    rows = args.content
      .split('\n')
      .filter((l: string) => l.trim())
      .map((l: string) => ({ Contenido: l }));
  }

  if (Array.isArray(rows) && rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const row of rows) {
      sheet.addRow(headers.map((h) => row[h] ?? ''));
    }

    for (const col of sheet.columns) {
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 2, 50);
    }
  }

  const filePath = path.join(args.saveDir, `${args.filename}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function createMarkdownDocument(args: {
  content: string;
  title: string;
  saveDir: string;
  filename: string;
}): Promise<string> {
  const filePath = path.join(args.saveDir, `${args.filename}.md`);
  const mdContent = `# ${args.title}\n\n${args.content}`;
  await fs.writeFile(filePath, mdContent, 'utf-8');
  return filePath;
}

const PDF_HTML_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
  h1 { color: #111; border-bottom: 1px solid #eee; padding-bottom: 10px; }
  h2 { color: #222; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
  p { margin-bottom: 15px; }
  strong { font-weight: 600; color: #000; }
`;

function markdownToBasicHtml(content: string): string {
  return content
    .replace(/## (.*?)\n/g, '<h2>$1</h2>\n')
    .replace(/# (.*?)\n/g, '<h1>$1</h1>\n')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>\n');
}

async function createPdfDocument(args: {
  content: string;
  title: string;
  saveDir: string;
  filename: string;
}): Promise<string> {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  const htmlContent = markdownToBasicHtml(args.content);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${PDF_HTML_STYLES}</style></head><body><h1>${args.title}</h1>${htmlContent}</body></html>`;
  const filePath = path.join(args.saveDir, `${args.filename}.pdf`);

  await new Promise<void>((resolve, reject) => {
    win.webContents.on('did-finish-load', async () => {
      try {
        const data = await win.webContents.printToPDF({ printBackground: true });
        await fs.writeFile(filePath, data);
        win.destroy();
        resolve();
      } catch (err) {
        win.destroy();
        reject(err);
      }
    });
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });

  return filePath;
}

async function createPresentationDocument(args: {
  content: string;
  title: string;
  saveDir: string;
  filename: string;
  slidesJson?: string;
  customTheme?: string;
  includeImages: boolean;
  ctx: ToolExecutorContext;
}): Promise<{ filePath: string; slideCount: number }> {
  // Carga premium con fallback al PDF básico si premium no está disponible.
  let premiumModule: { createPresentationPDF: (...args: unknown[]) => Promise<unknown>; parseMarkdownToSlides: (content: string, title: string) => unknown[] };
  try {
    premiumModule = await import('../../presentation-premium') as typeof premiumModule;
  } catch (importErr) {
    console.warn('[create_document] presentation-premium no disponible, usando fallback:', importErr);
    premiumModule = await import('../../presentation-pdf') as typeof premiumModule;
  }
  const { createPresentationPDF, parseMarkdownToSlides } = premiumModule;

  let slides: unknown[];
  if (args.slidesJson) {
    try {
      slides = JSON.parse(args.slidesJson);
    } catch {
      slides = parseMarkdownToSlides(args.content || '', args.title);
    }
  } else {
    slides = parseMarkdownToSlides(args.content || '', args.title);
  }

  let customTheme: unknown = undefined;
  if (args.customTheme) {
    try {
      customTheme = JSON.parse(args.customTheme);
    } catch {
      console.warn('[create_document] Failed to parse custom_theme, using default');
    }
  }

  const filePath = path.join(args.saveDir, `${args.filename}.pdf`);
  await createPresentationPDF({
    slides,
    title: args.title,
    outputPath: filePath,
    customTheme,
    includeImages: args.includeImages,
    genAI: args.ctx.getGenAI(),
  });

  return { filePath, slideCount: slides.length };
}

export async function handleCreateDocument(
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
): Promise<FunctionResponse> {
  try {
    const docType = toolArgs.type?.toLowerCase();
    const filename = toolArgs.filename || 'documento';
    const title = toolArgs.title || filename;
    const saveDir = await resolveSaveDirectory(toolArgs.save_directory || '');
    const baseArgs = { content: toolArgs.content, title, saveDir, filename };

    if (docType === 'word' || docType === 'docx') {
      const filePath = await createWordDocument(baseArgs);
      return buildResponse(TOOL_NAME, {
        success: true,
        file_path: filePath,
        message: `Documento Word profesional creado: ${filePath}`,
      });
    }

    if (docType === 'excel' || docType === 'xlsx') {
      const filePath = await createExcelDocument(baseArgs);
      return buildResponse(TOOL_NAME, {
        success: true,
        file_path: filePath,
        message: `Documento Excel creado: ${filePath}`,
      });
    }

    if (docType === 'md' || docType === 'markdown') {
      const filePath = await createMarkdownDocument(baseArgs);
      return buildResponse(TOOL_NAME, {
        success: true,
        file_path: filePath,
        message: `Documento Markdown creado: ${filePath}`,
      });
    }

    if (docType === 'pdf') {
      const filePath = await createPdfDocument(baseArgs);
      return buildResponse(TOOL_NAME, {
        success: true,
        file_path: filePath,
        message: `Documento PDF creado: ${filePath}`,
      });
    }

    if (docType === 'pptx' || docType === 'powerpoint' || docType === 'presentacion') {
      const { filePath, slideCount } = await createPresentationDocument({
        ...baseArgs,
        slidesJson: toolArgs.slides_json,
        customTheme: toolArgs.custom_theme,
        includeImages: toolArgs.include_images !== false,
        ctx,
      });
      return buildResponse(TOOL_NAME, {
        success: true,
        file_path: filePath,
        message: `Presentación PDF premium creada: ${filePath} (${slideCount} diapositivas con diseño profesional e imágenes AI)`,
      });
    }

    return errorResponse(TOOL_NAME, 'Tipo no válido. Usa "word", "excel", "pdf", "pptx" o "md".');
  } catch (err: any) {
    return errorResponse(TOOL_NAME, err.message);
  }
}
