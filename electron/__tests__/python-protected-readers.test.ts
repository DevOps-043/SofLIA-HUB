import fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleReadFile } from '../computer-use/filesystem-handlers/read-write';
const { runtime, extract } = vi.hoisted(() => ({ runtime: { isAvailable: vi.fn(() => false), parseDocument: vi.fn(), capturePrivacyContext: vi.fn() }, extract: vi.fn(async () => ({ value: 'texto sin redactar ficticio' })) }));
vi.mock('../python-tools-service', () => ({ pythonToolsService: runtime, isSidecarDocument: (file: string) => file.endsWith('.docx') }));
vi.mock('mammoth', () => ({ extractRawText: extract }));
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(fs, 'stat').mockResolvedValue({ isDirectory: () => false, size: 12 } as Awaited<ReturnType<typeof fs.stat>>); vi.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from('ficticio')); });
describe('Respaldo DOCX y privacidad', () => {
  it('sin protección conserva el lector TypeScript disponible', async () => {
    runtime.capturePrivacyContext.mockReturnValue({ config: { redactDocuments: false }, assertCurrent: () => {} });
    expect(await handleReadFile({ path: 'C:/ficticio.docx' })).toMatchObject({ success: true, content: 'texto sin redactar ficticio' }); expect(extract).toHaveBeenCalledOnce();
  });
  it('con protección no usa mammoth cuando falta Python', async () => {
    runtime.capturePrivacyContext.mockReturnValue({ config: { redactDocuments: true }, assertCurrent: () => {} });
    expect(await handleReadFile({ path: 'C:/ficticio.docx' })).toMatchObject({ success: false, code: 'PRIVACY_READER_REQUIRED' }); expect(extract).not.toHaveBeenCalled();
  });
  it('no entrega respaldo si cambió la política durante la extracción', async () => {
    let changed = false;
    runtime.capturePrivacyContext.mockReturnValue({ config: { redactDocuments: false }, assertCurrent: () => { if (changed) throw new Error('PRIVACY_CHANGED'); } });
    extract.mockImplementationOnce(async () => { changed = true; return { value: 'texto ficticio que debe descartarse' }; });
    expect(await handleReadFile({ path: 'C:/ficticio.docx' })).toMatchObject({ success: false });
  });
});
