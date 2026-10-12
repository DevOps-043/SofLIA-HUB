import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const window = vi.hoisted(() => ({ load: vi.fn(), print: vi.fn(), destroy: vi.fn(), construct: vi.fn() }));
vi.mock('electron', () => ({ BrowserWindow: class {
  constructor(options: unknown) { window.construct(options); }
  loadURL = window.load;
  webContents = { printToPDF: window.print };
  destroy = window.destroy;
  isDestroyed = () => false;
} }));
import { createPdfDocument } from '../wa-executor/handlers/create-document/pdf-document';
let directory: string;
beforeEach(async () => {
  vi.resetAllMocks();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-pdf-design-'));
  window.load.mockResolvedValue(undefined); window.print.mockResolvedValue(Buffer.from('%PDF-1.7 ejemplo'));
});
afterEach(async () => { vi.useRealTimers(); await fs.rm(directory, { recursive: true, force: true }); });
const args = () => ({ title: 'Documento', content: '## Resumen\n\nContenido completo', filename: 'documento', saveDir: directory });
it('exporta Carta desde HTML aislado y libera la ventana oculta', async () => {
  const output = await createPdfDocument(args());
  expect(await fs.readFile(output, 'utf8')).toContain('%PDF-');
  const url = decodeURIComponent(window.load.mock.calls[0][0]);
  expect(url).toContain("default-src 'none'"); expect(url).toContain('<h2>Resumen</h2>');
  expect(window.construct).toHaveBeenCalledWith(expect.objectContaining({ show: false, webPreferences: expect.objectContaining({ sandbox: true, nodeIntegration: false }) }));
  expect(window.print).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 'Letter', displayHeaderFooter: true }));
  expect(window.destroy).toHaveBeenCalledTimes(1);
});
it('un fallo de carga no deja archivo ni ventana abiertos', async () => {
  window.load.mockRejectedValue(new Error('Carga fallida'));
  await expect(createPdfDocument(args())).rejects.toThrow('Carga fallida');
  expect(window.destroy).toHaveBeenCalledTimes(1); expect(window.print).not.toHaveBeenCalled();
  expect(await fs.readdir(directory)).toEqual([]);
});
it('un print bloqueado vence y libera recursos sin guardar un PDF parcial', async () => {
  vi.useFakeTimers(); window.print.mockImplementation(() => new Promise(() => {}));
  const result = expect(createPdfDocument(args())).rejects.toThrow('agotó su tiempo');
  await vi.advanceTimersByTimeAsync(30_001); await result;
  expect(window.destroy).toHaveBeenCalledTimes(1); expect(await fs.readdir(directory)).toEqual([]);
});
it('una preferencia no válida se rechaza antes de abrir la ventana', async () => {
  await expect(createPdfDocument({ ...args(), design: { accentColor: '</style>' } })).rejects.toThrow();
  expect(window.construct).not.toHaveBeenCalled(); expect(await fs.readdir(directory)).toEqual([]);
});
