import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dialog } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  nextBrowserZoomFactor,
  saveBrowserPageAsPdf,
  validateFindQuery,
} from '../integrated-browser/page-tools';

const files: string[] = [];
afterEach(() => files.splice(0).forEach((file) => fs.rmSync(file, { force: true })));

describe('herramientas de página', () => {
  it('acota el zoom y permite restablecerlo', () => {
    expect(nextBrowserZoomFactor(2.95, 'in')).toBe(3);
    expect(nextBrowserZoomFactor(0.5, 'out')).toBe(0.5);
    expect(nextBrowserZoomFactor(2, 'reset')).toBe(1);
  });

  it('rechaza búsquedas fuera del contrato', () => {
    expect(validateFindQuery('informe')).toBe('informe');
    expect(() => validateFindQuery(42)).toThrow(/cadena/);
    expect(() => validateFindQuery('x'.repeat(501))).toThrow(/demasiado largo/);
  });

  it('guarda PDF en destino explícito sin sobrescritura silenciosa', async () => {
    const destination = path.join(os.tmpdir(), `soflia-${Date.now()}-${Math.random()}.pdf`);
    files.push(destination);
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: destination });
    const contents = { printToPDF: vi.fn(async () => Buffer.from('pdf')) };
    const result = await saveBrowserPageAsPdf({} as never, contents as never, 'Informe: trimestral');
    expect(result).toEqual({ canceled: false, filename: path.basename(destination) });
    expect(fs.readFileSync(destination, 'utf8')).toBe('pdf');
    await expect(saveBrowserPageAsPdf({} as never, contents as never, 'Informe'))
      .rejects.toThrow(/ya existe/);
  });
});
