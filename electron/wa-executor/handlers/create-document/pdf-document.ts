import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildDocumentHtml, documentPrintTemplates } from '../../../document-designer/html-document';
import { resolveDocumentDesign } from '../../../../src/shared/document-design';
import type { DocumentBaseArgs } from './types';

const PDF_TIMEOUT_MS = 30_000;
export async function createPdfDocument(args: DocumentBaseArgs): Promise<string> {
  const html = buildDocumentHtml(args);
  const templates = documentPrintTemplates(args.title, resolveDocumentDesign(args.design, args.brand));
  const filePath = path.join(args.saveDir, `${args.filename}.pdf`);
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = async () => {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      return win.webContents.printToPDF({ printBackground: true, pageSize: 'Letter', preferCSSPageSize: true,
        displayHeaderFooter: true, ...templates,
      });
    };
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('La generación del PDF agotó su tiempo.')), PDF_TIMEOUT_MS); });
    const data = await Promise.race([operation(), deadline]);
    await args.beforeSave?.();
    await fs.writeFile(filePath, data);
    return filePath;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (!win.isDestroyed()) win.destroy();
  }
}
