import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createWorker: vi.fn(), recognize: vi.fn(), terminate: vi.fn() }));
vi.mock('node:module', () => ({ createRequire: () => () => ({ createWorker: mocks.createWorker }) }));
import { findTextCoordinates } from '../computer-use/ocr-targeting';
import { Worker } from 'node:worker_threads';
import { selectOcrTarget } from '../computer-use/gui/ocr-elements';
beforeEach(() => { vi.resetAllMocks(); mocks.createWorker.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate }); mocks.terminate.mockResolvedValue(undefined); });
describe('OCR Computer Use con Tesseract 7', () => {
  it('lee palabras de blocks y pide su salida explícitamente', async () => {
    mocks.recognize.mockResolvedValue({ data: { blocks: [{ paragraphs: [{ lines: [{ text: 'Abrir', confidence: 70, bbox: { x0: 10, y0: 20, x1: 30, y1: 40 }, words: [{ text: 'Abrir', confidence: 80, bbox: { x0: 10, y0: 20, x1: 30, y1: 40 } }] }] }] }] } });
    expect(await findTextCoordinates('Abrir', Buffer.from('imagen-ficticia'))).toEqual({ x: 20, y: 30, confidence: 80 });
    expect(mocks.recognize).toHaveBeenCalledWith(expect.any(Buffer), {}, { blocks: true });
  });
  it('si reconocer falla siempre termina el worker', async () => {
    mocks.recognize.mockRejectedValue(new Error('error-ficticio'));
    await expect(findTextCoordinates('Abrir', Buffer.from('imagen-ficticia'))).rejects.toThrow();
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });
  it('fallback de idioma sólo después de fallo y con revisión vigente', async () => {
    mocks.createWorker.mockRejectedValueOnce(new Error('spa no disponible'));
    mocks.recognize.mockResolvedValue({ data: { blocks: [] } });
    await expect(findTextCoordinates('Abrir', Buffer.from('imagen'))).rejects.toThrow();
    expect(mocks.createWorker.mock.calls.map(call => call[0])).toEqual(['spa', 'eng']); expect(mocks.terminate).toHaveBeenCalledOnce();
  });
  it('si revoca durante creación tardía termina worker y no reconoce', async () => {
    const controller = new AbortController();
    mocks.createWorker.mockImplementationOnce(async () => { controller.abort(); return { recognize: mocks.recognize, terminate: mocks.terminate }; });
    await expect(findTextCoordinates('Abrir', Buffer.from('imagen'), { signal: controller.signal })).rejects.toThrow();
    expect(mocks.recognize).not.toHaveBeenCalled(); expect(mocks.terminate).toHaveBeenCalledOnce();
  });
  it('si creación falla tras revocar no inicia idioma alternativo', async () => {
    const controller = new AbortController(); mocks.createWorker.mockImplementationOnce(async () => { controller.abort(); throw new Error('privado'); });
    await expect(findTextCoordinates('Abrir', Buffer.from('imagen'), { signal: controller.signal })).rejects.toThrow();
    expect(mocks.createWorker).toHaveBeenCalledOnce();
  });
  it('terminación pública temprana no se confunde con exit del thread real', async () => {
    const thread = new Worker('setInterval(() => {}, 1000)', { eval: true });
    const controller = new AbortController();
    mocks.createWorker.mockResolvedValueOnce({ worker: thread, recognize: mocks.recognize, terminate: async () => { void thread.terminate(); } });
    mocks.recognize.mockImplementationOnce(() => new Promise(() => {}));
    const pending = findTextCoordinates('Abrir', Buffer.from('imagen'), { signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow(); await vi.waitFor(() => expect(mocks.recognize).toHaveBeenCalled());
    controller.abort(); await rejected; expect(thread.threadId).toBe(-1);
  });
  it('fallo al terminar nunca confirma resultado OCR', async () => {
    mocks.recognize.mockResolvedValue({ data: { blocks: [] } }); mocks.terminate.mockRejectedValueOnce(new Error('privado'));
    await expect(findTextCoordinates('Abrir', Buffer.from('imagen'))).rejects.not.toThrow('privado');
  });
  it('línea válida conserva búsqueda cuando palabras no tienen confianza', () => {
    const line = { text: 'Abrir archivo', confidence: 60, bbox: { x0: 0, y0: 0, x1: 40, y1: 20 }, words: [{ text: 'Abrir', confidence: NaN }] };
    expect(selectOcrTarget({ data: { blocks: [{ paragraphs: [{ lines: [line] }] }] } }, 'archivo')).toEqual({ x: 20, y: 10, confidence: 60 });
  });
  it.each([null, {}, { data: { blocks: null } }, { data: { words: [] } }, { data: { blocks: Array(50001).fill(null) } }])('estructura inválida no inventa coordenadas %#', value => {
    expect(() => selectOcrTarget(value, 'Abrir')).toThrow();
  });
  it('dos objetivos distintos no eligen el primero de forma silenciosa', () => {
    const words = [10, 100].map(x => ({ text: 'Abrir', confidence: 90, bbox: { x0: x, y0: 0, x1: x + 10, y1: 10 } }));
    expect(() => selectOcrTarget({ data: { blocks: [{ paragraphs: [{ lines: [{ words }] }] }] } }, 'Abrir')).toThrow(expect.objectContaining({ code: 'GUI_AMBIGUOUS_TARGET' }));
  });
  it('texto agregado excesivo se rechaza antes de buscar coincidencias', () => {
    const words = Array.from({ length: 21 }, () => ({ text: 'a'.repeat(100000), confidence: 90, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }));
    expect(() => selectOcrTarget({ data: { blocks: [{ paragraphs: [{ lines: [{ words }] }] }] } }, 'Abrir')).toThrow();
  });
});
