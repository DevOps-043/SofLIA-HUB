import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadPdf } from './pdf-runtime';

export function PdfPreview({ base64 }: { base64: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(500);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageText, setPageText] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true; let close = () => {};
    void loadPdf(base64).then(async handle => {
      close = handle.close;
      if (!active) { close(); return; }
      try { const pdf = await handle.task.promise; if (active) setDocument(pdf); }
      catch (failure) { if (active) { setError(pdfError(failure)); setLoading(false); } }
    }).catch(failure => { if (active) { setError(pdfError(failure)); setLoading(false); } });
    return () => { active = false; close(); };
  }, [base64]);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(200, node.clientWidth - 32));
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document) return;
    let active = true; let renderTask: RenderTask | undefined;
    void (async () => {
      const pdfPage = await document.getPage(page);
      if (!active) return;
      setLoading(true); setError(''); setPageText('');
      const natural = pdfPage.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const desired = width / natural.width * zoom * ratio;
      const scale = Math.min(desired, Math.sqrt(16_000_000 / (natural.width * natural.height)), 4);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      canvas.style.width = viewport.width / ratio + 'px'; canvas.style.height = viewport.height / ratio + 'px';
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Página ' + page + ' del PDF');
      // Un canvas nuevo por render evita escrituras simultáneas al cambiar de página o zoom.
      renderTask = pdfPage.render({ canvas, viewport });
      await renderTask.promise;
      const text = await pdfPage.getTextContent();
      if (!active) return;
      canvasHost.current?.replaceChildren(canvas);
      setPageText(text.items.map(item => 'str' in item ? item.str : '').join(' ').slice(0, 20000));
      setLoading(false);
    })().catch(failure => { if (active) { setError(pdfError(failure)); setLoading(false); } });
    return () => { active = false; renderTask?.cancel(); };
  }, [document, page, width, zoom]);
  return <div className="artifact-pdf-view" ref={container}>
    <nav className="artifact-pdf-toolbar" aria-label="Controles del PDF"><button type="button" disabled={!document || page === 1} onClick={() => setPage(value => value - 1)}>← Anterior</button><span>Página {page} de {document?.numPages ?? '…'}</span><button type="button" disabled={!document || page >= document.numPages} onClick={() => setPage(value => value + 1)}>Siguiente →</button><button type="button" aria-label="Reducir zoom" disabled={zoom <= .5} onClick={() => setZoom(value => Math.max(.5, value - .25))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Aumentar zoom" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + .25))}>+</button></nav>
    {loading && <p role="status" className="artifact-preview-note">Dibujando página…</p>}
    {error && <p role="alert" className="artifact-preview-note">{error}</p>}
    <div className="artifact-pdf-canvas" ref={canvasHost} />
    {pageText && <details className="artifact-pdf-text"><summary>Texto de la página</summary><p>{pageText}</p></details>}
  </div>;
}
function pdfError(error: unknown): string {
  return error instanceof Error && error.name === 'PasswordException' ? 'Este PDF está protegido con contraseña. Abre una copia desbloqueada.' : 'No pude dibujar este PDF. Comprueba que el archivo sea válido o guarda una copia para abrirlo fuera.';
}
