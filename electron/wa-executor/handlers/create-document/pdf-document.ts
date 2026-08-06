import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DocumentBaseArgs } from './types';

const PDF_HTML_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
  h1 { color: #111; border-bottom: 1px solid #eee; padding-bottom: 10px; }
  h2 { color: #222; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
  p { margin-bottom: 15px; }
  strong { font-weight: 600; color: #000; }
`;

export async function createPdfDocument(args: DocumentBaseArgs): Promise<string> {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: { deviceScaleFactor: 1 } } });
  const html = buildPdfHtml(args.title, args.content);
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

function buildPdfHtml(title: string, content: string): string {
  const body = markdownToBasicHtml(content);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${PDF_HTML_STYLES}</style></head><body><h1>${title}</h1>${body}</body></html>`;
}

function markdownToBasicHtml(content: string): string {
  return content
    .replace(/## (.*?)\n/g, '<h2>$1</h2>\n')
    .replace(/# (.*?)\n/g, '<h1>$1</h1>\n')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>\n');
}
