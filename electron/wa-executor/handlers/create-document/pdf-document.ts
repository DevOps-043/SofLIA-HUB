import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildDocumentHtml } from '../../../document-designer/html-document';
import type { DocumentBaseArgs } from './types';

const PDF_TIMEOUT_MS = 30_000;
export async function createPdfDocument(args: DocumentBaseArgs): Promise<string> {
  const html = buildDocumentHtml(args);
  const filePath = path.join(args.saveDir, `${args.filename}.pdf`);
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = async () => {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      return win.webContents.printToPDF({ printBackground: true, pageSize: 'Letter', preferCSSPageSize: true,
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: '<div style="width:100%;font:9px Arial;color:#5C6670;text-align:right;padding:0 72px">SofLIA · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      });
    };
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('La generación del PDF agotó su tiempo.')), PDF_TIMEOUT_MS); });
    const data = await Promise.race([operation(), deadline]);
    await fs.writeFile(filePath, data);
    return filePath;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (!win.isDestroyed()) win.destroy();
  }
}
