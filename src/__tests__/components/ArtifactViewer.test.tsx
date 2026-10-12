import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ArtifactViewerProvider } from '../../components/artifacts/ArtifactViewerProvider';
import { ArtifactViewerPanel } from '../../components/artifacts/ArtifactViewerPanel';
import { ArtifactContent } from '../../components/artifacts/ArtifactContent';
import { TeamFiles } from '../../components/agents/TeamFiles';
import { artifactViewerService } from '../../services/artifact-viewer';
import { isolatedPreviewHtml } from '../../shared/artifact-preview-html';
import type { ArtifactPreview, ViewerFile } from '../../shared/artifact-viewer';
import { useArtifactViewer } from '../../components/artifacts/artifact-viewer-context';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const files = [{ id: 'archivo-uno', name: 'propuesta.md', role: 'especialista-uno', format: 'md' as const, verified: true, bytes: 100, hash: 'hash', inputHash: 'hash' }, { id: 'archivo-dos', name: 'sintesis.md', role: 'coordinador', format: 'md' as const, verified: true, bytes: 80, hash: 'hash', inputHash: 'hash' }];
const preview: ArtifactPreview = { reference: { kind: 'team', jobId: 'equipo', artifactId: 'archivo-uno' }, name: 'propuesta.md', extension: 'md', bytes: 100, content: { kind: 'markdown', text: '# Propuesta\n\n**Idea completa**', truncated: false } };
function renderViewer() { return render(<ArtifactViewerProvider><TeamFiles jobId="equipo" files={files} /><ArtifactViewerPanel /></ArtifactViewerProvider>); }
it('mantiene visible la pestaña seleccionada al estrechar el visor sin releer el archivo', async () => {
  const observers: Observer[] = [];
  class Observer implements ResizeObserver {
    constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
    observe = vi.fn<(target: Element) => void>();
    unobserve = vi.fn<(target: Element) => void>();
    disconnect = vi.fn<() => void>();
  }
  vi.stubGlobal('ResizeObserver', Observer);
  const read = vi.spyOn(artifactViewerService, 'preview').mockResolvedValue(preview);
  const view = renderViewer(); fireEvent.click(screen.getByRole('button', { name: 'Abrir propuesta.md' }));
  await screen.findByText('Idea completa');
  const navigation = screen.getByRole('navigation', { name: 'Archivos abiertos' });
  const selected = screen.getByRole('button', { name: 'propuesta.md' });
  selected.scrollIntoView = vi.fn();
  const observer = observers.find(item => item.observe.mock.calls.some(([target]) => target === navigation))!;
  expect(observer).toBeDefined();
  act(() => observer.callback([], observer));
  expect(selected.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  expect(read).toHaveBeenCalledTimes(1);
  view.unmount(); expect(observer.disconnect).toHaveBeenCalledTimes(1);
});
it('abre una tarjeta dentro del chat, muestra formato y navega entre entregables', async () => {
  const read = vi.spyOn(artifactViewerService, 'preview').mockResolvedValue(preview);
  const external = vi.spyOn(artifactViewerService, 'openExternal').mockResolvedValue(null);
  const save = vi.spyOn(artifactViewerService, 'saveCopy').mockResolvedValue(true);
  renderViewer(); fireEvent.click(screen.getByRole('button', { name: 'Abrir propuesta.md' }));
  expect(await screen.findByText('Idea completa')).toBeInTheDocument();
  expect(screen.getByText('Idea completa').closest('strong')).not.toBeNull(); expect(external).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'sintesis.md' }));
  await waitFor(() => expect(read).toHaveBeenLastCalledWith({ kind: 'team', jobId: 'equipo', artifactId: 'archivo-dos' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar copia' })); });
  expect(save).toHaveBeenCalledWith({ kind: 'team', jobId: 'equipo', artifactId: 'archivo-dos' });
  expect(screen.getByText('Copia guardada.')).toBeInTheDocument();
});
it('muestra errores de lectura y permite reintentar sin abrir Windows automáticamente', async () => {
  const read = vi.spyOn(artifactViewerService, 'preview').mockRejectedValueOnce(new Error('El archivo cambió.')).mockResolvedValue(preview);
  renderViewer(); fireEvent.click(screen.getByRole('button', { name: 'Abrir propuesta.md' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('El archivo cambió.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('Idea completa')).toBeInTheDocument(); expect(read).toHaveBeenCalledTimes(2);
});
it('descarta una lectura anterior cuando se cambia de archivo', async () => {
  let resolve!: (value: ArtifactPreview) => void;
  vi.spyOn(artifactViewerService, 'preview').mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue({ ...preview, content: { kind: 'markdown', text: 'Contenido del segundo archivo', truncated: false } });
  renderViewer(); fireEvent.click(screen.getByRole('button', { name: 'Abrir propuesta.md' }));
  fireEvent.click(screen.getByRole('button', { name: 'sintesis.md' }));
  expect(await screen.findByText('Contenido del segundo archivo')).toBeInTheDocument();
  await act(async () => resolve(preview)); expect(screen.queryByText('Idea completa')).not.toBeInTheDocument();
});
it('representa Excel con hojas y texto escapado en lugar de HTML ejecutable', () => {
  render(<ArtifactContent source={false} preview={{ ...preview, extension: 'xlsx', content: { kind: 'spreadsheet', truncated: false, sheets: [{ name: 'Datos', truncated: false, rows: [['Concepto', 'Monto'], ['<script>robar()</script>', '250']] }, { name: 'Notas', truncated: false, rows: [['Nota real']] }] } }} />);
  expect(screen.getByRole('table', { name: 'Hoja Datos' })).toBeInTheDocument(); expect(screen.getByText('<script>robar()</script>')).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Notas' })); expect(screen.getByText('Nota real')).toBeInTheDocument();
});
it('aísla HTML interactivo sin same-origin, red ni ventanas emergentes', () => {
  render(<ArtifactContent source={false} preview={{ ...preview, content: { kind: 'html', text: '<button>Probar</button><script>window.valor=1</script>', url: 'http://127.0.0.1:1234/preview', truncated: false } }} />);
  const frame = screen.getByTitle('Vista previa de la aplicación');
  expect(frame).toHaveAttribute('sandbox', 'allow-scripts'); expect(frame).not.toHaveAttribute('allow-same-origin');
  expect(frame).not.toHaveAttribute('srcdoc'); expect(frame).toHaveAttribute('src', 'http://127.0.0.1:1234/preview');
  expect(isolatedPreviewHtml('<p>Documento</p>', false)).toContain("script-src 'none'");
});
it('revoca blobs de imágenes al desmontarse y no usa rutas locales como src', async () => {
  const create = vi.fn(() => 'blob:imagen-local'); const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  const view = render(<ArtifactContent source={false} preview={{ ...preview, content: { kind: 'image', base64: btoa('imagen'), mime: 'image/png' } }} />);
  expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:imagen-local'); view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:imagen-local');
});
it('abre Word en el origen de lectura con sandbox sin scripts y sin srcdoc heredado', () => {
  render(<ArtifactContent source={false} preview={{ ...preview, extension: 'docx', content: { kind: 'document', text: '<h1>Documento</h1>', url: 'http://127.0.0.1:1234/documento', truncated: false } }} />);
  const frame = screen.getByTitle('Vista previa del documento');
  expect(frame).toHaveAttribute('src', 'http://127.0.0.1:1234/documento'); expect(frame).toHaveAttribute('sandbox', '');
  expect(frame).not.toHaveAttribute('srcdoc');
  expect(screen.getByRole('status')).toHaveTextContent('Cargando vista previa'); fireEvent.load(frame); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByText(/Vista de lectura/)).not.toBeInTheDocument();
});
it('cancelar el selector mantiene el visor actual y desmontarlo descarta selecciones tardías', async () => {
  const pick = vi.spyOn(artifactViewerService, 'pick').mockResolvedValueOnce(null);
  function Picker() { const viewer = useArtifactViewer()!; return <button onClick={() => void viewer.pick()}>Elegir archivo</button>; }
  const view = render(<ArtifactViewerProvider><Picker /><ArtifactViewerPanel /></ArtifactViewerProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Elegir archivo')); }); expect(screen.queryByLabelText('Visor de archivos')).not.toBeInTheDocument();
  let finish!: (file: ViewerFile) => void; pick.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  fireEvent.click(screen.getByText('Elegir archivo')); view.unmount();
  await act(async () => finish(preview)); expect(screen.queryByLabelText('Visor de archivos')).not.toBeInTheDocument();
});

it('ajusta el visor con teclado sin recargar y mantiene acciones en la cabecera', async () => {
  localStorage.removeItem('soflia:artifact-viewer-width');
  const read = vi.spyOn(artifactViewerService, 'preview').mockResolvedValue(preview);
  const view = renderViewer(); fireEvent.click(screen.getByRole('button', { name: 'Abrir propuesta.md' }));
  await screen.findByText('Idea completa');
  const separator = screen.getByRole('separator', { name: 'Cambiar ancho del visor' });
  const before = Number(separator.getAttribute('aria-valuenow'));
  fireEvent.keyDown(separator, { key: 'ArrowRight' });
  expect(Number(separator.getAttribute('aria-valuenow'))).toBe(before - 32);
  expect(read).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Guardar copia' }).closest('header')).toBe(screen.getByRole('button', { name: 'Código' }).closest('header'));
  expect(screen.queryByText(/Vista local/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Abrir propuesta.md' })).toHaveAttribute('aria-current', 'true');
  view.unmount(); localStorage.removeItem('soflia:artifact-viewer-width');
});

it('cerrar durante un arrastre libera el visor al reabrirlo', async () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(artifactViewerService, 'preview').mockResolvedValue(preview);
  renderViewer(); fireEvent.click(screen.getByRole('button', { name: 'Abrir propuesta.md' }));
  await screen.findByText('Idea completa');
  const separator = screen.getByRole('separator', { name: 'Cambiar ancho del visor' });
  Object.assign(separator, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() });
  fireEvent.pointerDown(separator, { button: 0, clientX: 600 });
  fireEvent.pointerMove(separator, { clientX: 580 });
  expect(screen.getByRole('region', { name: 'Visor de archivos' })).toHaveClass('resizing');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar visor' }));
  fireEvent.click(screen.getByRole('button', { name: 'Abrir propuesta.md' }));
  await screen.findByText('Idea completa');
  expect(screen.getByRole('region', { name: 'Visor de archivos' })).not.toHaveClass('resizing');
});
