import { afterEach, expect, it, vi } from 'vitest';
import { loadPdf } from '../../components/artifacts/pdf-runtime';
const mocks = vi.hoisted(() => ({ destroy: vi.fn(), workerDestroy: vi.fn(), getDocument: vi.fn() }));
vi.mock('pdfjs-dist', () => ({ PDFWorker: { create: () => ({ destroy: mocks.workerDestroy }) }, getDocument: mocks.getDocument }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '/pdf-test-worker.mjs' }));
class SilentWorker extends EventTarget { terminate = vi.fn(); constructor() { super(); instances.push(this); } }
const instances: SilentWorker[] = [];
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); instances.splice(0); });
function setup() {
  vi.stubGlobal('Worker', SilentWorker);
  mocks.destroy.mockImplementation(() => new Promise(() => {}));
  mocks.getDocument.mockReturnValue({ promise: new Promise(() => {}), destroy: mocks.destroy });
}
it('termina el worker inmediatamente al cerrar aunque PDF.js no responda al destroy', async () => {
  setup(); const handle = await loadPdf(btoa('PDF')); const result = handle.task.promise.catch(error => error);
  handle.close(); handle.close();
  expect(instances[0].terminate).toHaveBeenCalledOnce(); expect(mocks.workerDestroy).toHaveBeenCalledOnce();
  expect(await result).toBeInstanceOf(Error);
});
it('rechaza una carga sin respuesta y termina el worker al agotarse el tiempo', async () => {
  vi.useFakeTimers(); setup(); const handle = await loadPdf(btoa('PDF')); const result = handle.task.promise.catch(error => error);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(await result).toBeInstanceOf(Error); expect(instances[0].terminate).toHaveBeenCalledOnce();
});
it('convierte un error de inicio del worker en una carga fallida y libera recursos', async () => {
  setup(); const handle = await loadPdf(btoa('PDF')); const result = handle.task.promise.catch(error => error);
  instances[0].dispatchEvent(new Event('error'));
  expect(await result).toBeInstanceOf(Error); expect(instances[0].terminate).toHaveBeenCalledOnce();
});
it('permite cerrar una inicialización tardía sin un rechazo no observado', async () => {
  setup(); const handle = await loadPdf(btoa('PDF')); handle.close();
  await Promise.resolve(); expect(instances[0].terminate).toHaveBeenCalledOnce();
});
