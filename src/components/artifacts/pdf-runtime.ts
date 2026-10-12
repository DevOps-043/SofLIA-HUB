import type { PDFDocumentProxy, PDFWorker } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Worker local, sin CDN ni evaluación de acciones/JavaScript del documento. */
export async function loadPdf(base64: string): Promise<{ task: { promise: Promise<PDFDocumentProxy> }; close(): void }> {
  const { getDocument, PDFWorker: WorkerClass } = await import('pdfjs-dist');
  const port = new Worker(workerUrl, { type: 'module' });
  let worker: PDFWorker | undefined;
  try {
    worker = WorkerClass.create({ port });
    const data = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const task = getDocument({ data, worker, disableFontFace: true, enableXfa: false, useWorkerFetch: false, useWasm: false,
      maxImageSize: 16_000_000, canvasMaxAreaInBytes: 64_000_000, verbosity: 0 });
    let closed = false;
    let rejectReady: (error: Error) => void = () => {};
    const close = () => {
      if (closed) return; closed = true;
      clearTimeout(timeout); port.removeEventListener('error', failed);
      rejectReady(new Error('Visor PDF cerrado.'));
      // Un worker sin respuesta no puede bloquear la liberación del proceso.
      worker?.destroy(); port.terminate();
      void task.destroy().catch(() => {});
    };
    const failed = () => { rejectReady(new Error('No se pudo iniciar el lector PDF.')); close(); };
    const timeout = setTimeout(failed, 20_000);
    port.addEventListener('error', failed, { once: true });
    const promise = new Promise<PDFDocumentProxy>((resolve, reject) => {
      rejectReady = reject;
      void task.promise.then(document => { clearTimeout(timeout); resolve(document); }, error => { clearTimeout(timeout); reject(error); close(); });
    });
    // La inicialización puede terminar después del desmontaje, antes de que React observe el rechazo.
    void promise.catch(() => {});
    return { task: { promise }, close };
  } catch (error) { worker?.destroy(); port.terminate(); throw error; }
}
