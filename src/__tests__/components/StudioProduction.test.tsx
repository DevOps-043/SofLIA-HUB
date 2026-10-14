import { act, fireEvent, render, renderHook, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { InstructorStudio } from '../../components/learning-live/instructor/InstructorStudio';
import { useStudioScenes } from '../../components/learning-live/instructor/useStudioScenes';
import type { StudioExamples } from '../../components/learning-live/instructor/studio-types';
import { StudioRuntimeContext, type StudioRuntime } from '../../components/learning-live/instructor/StudioRuntimeContext';
import { StudioMediaContext, type StudioMediaRuntime } from '../../components/learning-live/instructor/StudioMediaContext';
import type { StudioCaptureBinding } from '../../shared/studio-capture';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { vi.unstubAllGlobals(); delete window.studioCapture; });
const examples: StudioExamples = { participants: 10, resources: [], messages: [{ id: '1', authorId: 'ana', author: 'Ana', role: 'participant', text: 'Mensaje del grupo principal', time: '12:00' }], scenes: [
  { id: 'opening', name: 'Apertura', kind: 'slide', title: 'Bienvenidos al taller', description: 'Empezamos aquí' },
  { id: 'practice', name: 'Práctica', kind: 'slide', title: 'Vamos a practicar', description: 'Trabaja en equipo' },
] };
const openStudio = () => render(<InstructorStudio examples={examples} onBack={vi.fn()} onClose={vi.fn()} />);
const stage = () => screen.getByRole('region', { name: 'Escenario seleccionado' });
const group = () => fireEvent.click(screen.getByRole('button', { name: 'Ver grupo y salas' }));

describe('salas y escenas del estudio', () => {
  it('cambia contenido y modo sin apagar compartir, cámara ni micrófono', () => {
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: 'Activar micrófono' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar escena Práctica' }));
    expect(stage()).toHaveTextContent('Vamos a practicar');
    expect(stage()).not.toHaveTextContent('Bienvenidos al taller');
    fireEvent.click(screen.getByRole('button', { name: 'Ver solo cámara' }));
    expect(stage()).not.toHaveTextContent('Vamos a practicar');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar escena Apertura' }));
    expect(stage()).toHaveTextContent('Bienvenidos al taller');
    expect(screen.getByRole('button', { name: 'Ver pantalla y cámara' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar escena Práctica' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver solo pantalla' }));
    expect(stage()).toHaveTextContent('Vamos a practicar');
    expect(stage()).not.toHaveTextContent('Cámara de ejemplo');
    fireEvent.click(screen.getByRole('button', { name: 'Ver pantalla y cámara' }));
    expect(stage()).toHaveTextContent('Cámara de ejemplo');
    for (const name of ['Dejar de compartir pantalla', 'Apagar cámara', 'Silenciar micrófono']) expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
  });
  it('prepara una lámina, la muestra y conserva una selección válida al quitarla', () => {
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva escena' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la escena' }), { target: { value: 'Cierre' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Título de la lámina' }), { target: { value: 'Comparte lo aprendido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar escena' }));
    expect(stage()).toHaveTextContent('Bienvenidos al taller');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar escena Cierre' }));
    expect(stage()).toHaveTextContent('Comparte lo aprendido');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar escena Cierre' }));
    expect(stage()).toHaveTextContent('Bienvenidos al taller');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar escena Apertura' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar escena Práctica' }));
    expect(stage()).toHaveTextContent('Tu siguiente escena, aquí.');
  });
  it('visita las salas creadas, separa mensajes y borradores y vuelve al grupo', () => {
    openStudio();
    group();
    expect(screen.getByRole('dialog')).toHaveTextContent('Aún no tienes salas');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu mensaje como instructor' }), { target: { value: 'Borrador principal' } });
    fireEvent.click(screen.getByRole('button', { name: /Salas de práctica/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preparar salas' }));
    group();
    expect(screen.getByRole('dialog')).toHaveTextContent('Sala 2');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar a Sala 2' }));
    expect(screen.getByRole('heading', { name: 'Sala 2' })).toBeInTheDocument();
    expect(screen.getByRole('log', { name: 'Mensajes de Sala 2' })).not.toHaveTextContent('Mensaje del grupo principal');
    expect(screen.getByRole('textbox', { name: 'Tu mensaje como instructor' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Tu mensaje como instructor' }), { target: { value: 'Retroalimentación del equipo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje a Sala 2' }));
    group();
    expect(screen.getByRole('button', { name: 'Ya estás en Sala 2' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al grupo principal' }));
    expect(screen.getByRole('log', { name: 'Mensajes de la sesión' })).toHaveTextContent('Mensaje del grupo principal');
    expect(screen.getByRole('log', { name: 'Mensajes de la sesión' })).not.toHaveTextContent('Retroalimentación del equipo');
    expect(screen.getByRole('textbox', { name: 'Tu mensaje como instructor' })).toHaveValue('Borrador principal');
    group(); fireEvent.click(screen.getByRole('button', { name: 'Entrar a Sala 2' }));
    expect(screen.getByRole('log', { name: 'Mensajes de Sala 2' })).toHaveTextContent('Retroalimentación del equipo');
    fireEvent.click(screen.getByRole('button', { name: /Salas de práctica/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preparar salas' }));
    expect(screen.queryByRole('heading', { name: 'Sala 2' })).not.toBeInTheDocument();
    group(); fireEvent.click(screen.getByRole('button', { name: 'Entrar a Sala 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar salas del diseño' }));
    expect(screen.queryByRole('heading', { name: 'Sala 1' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Modo de vista previa' })).getByRole('button', { name: 'Ver pantalla y cámara' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('medios locales de escenas', () => {
  it('renueva URLs académicas importadas sin recrear escenas eliminadas ni reemplazar la preparación local', () => {
    const initial = [{ id: 'importada', name: 'Preparada', kind: 'image' as const, title: 'Imagen', description: '', assetUrl: 'https://ejemplo.test/primera' }];
    const view = renderHook(({ scenes }) => useStudioScenes(scenes), { initialProps: { scenes: initial } });
    view.rerender({ scenes: [{ ...initial[0], assetUrl: 'https://ejemplo.test/renovada' }] });
    expect(view.result.current.activeScene?.assetUrl).toBe('https://ejemplo.test/renovada');
    act(() => view.result.current.removeScene('importada'));
    view.rerender({ scenes: initial }); expect(view.result.current.scenes).toHaveLength(0);
  });
  it('crea, selecciona y quita escenas aunque Learning rechace cualquier comando', () => {
    const send = vi.fn(async () => false), upload = vi.fn(async () => { throw new Error('No disponible'); });
    const runtime = { send, upload } as unknown as StudioRuntime;
    const view = renderHook(() => useStudioScenes(), { wrapper: ({ children }) => <StudioRuntimeContext.Provider value={runtime}>{children}</StudioRuntimeContext.Provider> });
    act(() => { expect(view.result.current.addScene({ name: 'Local', kind: 'slide', title: 'Contenido local', description: '', file: null })).toBeNull(); });
    const id = view.result.current.scenes[0].id;
    act(() => view.result.current.selectScene(id)); expect(view.result.current.activeScene?.title).toBe('Contenido local');
    act(() => view.result.current.removeScene(id)); expect(view.result.current.scenes).toHaveLength(0);
    expect(send).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
  });
  it('requiere una fuente real y conserva el vínculo hasta quitar la escena', async () => {
    const capture: StudioCaptureBinding = { id: crypto.randomUUID(), name: 'ChatGPT', kind: 'window', thumbnail: null, withSystemAudio: false };
    const release = vi.fn(async () => ({ success: true })); window.studioCapture = { release, choose: vi.fn(), activate: vi.fn(), clear: vi.fn() };
    const view = renderHook(() => useStudioScenes());
    const draft = { name: 'ChatGPT', kind: 'screen' as const, title: 'Nombre libre', description: '', file: null };
    act(() => { expect(view.result.current.addScene(draft)).toContain('Vincula'); });
    act(() => { expect(view.result.current.addScene({ ...draft, capture })).toBeNull(); });
    const id = view.result.current.activeScene!.id;
    act(() => view.result.current.selectScene(id)); expect(view.result.current.activeScene?.capture?.id).toBe(capture.id); expect(release).not.toHaveBeenCalled();
    act(() => view.result.current.removeScene(id)); await waitFor(() => expect(release).toHaveBeenCalledWith({ bindingId: capture.id }));
  });
  it('elige una ventana real en el editor y Compartir reutiliza esa fuente', async () => {
    const capture: StudioCaptureBinding = { id: crypto.randomUUID(), name: 'ChatGPT', kind: 'window', thumbnail: 'data:image/png;base64,aA==', withSystemAudio: false };
    const choose = vi.fn(async () => ({ success: true as const, binding: capture }));
    window.studioCapture = { choose, activate: vi.fn(async () => ({ success: true })), release: vi.fn(async () => ({ success: true })), clear: vi.fn(async () => ({ success: true })) };
    const shareBinding = vi.fn(async () => true);
    const media = { screen: null, camera: null, mic: null, pending: false, zoomConnected: false, zoomPending: false, zoomSharing: false, zoomStage: null, shareBinding, stopScreen: vi.fn(), toggle: vi.fn(), connectZoom: vi.fn() } as unknown as StudioMediaRuntime;
    render(<StudioMediaContext.Provider value={media}><InstructorStudio onBack={vi.fn()} onClose={vi.fn()} /></StudioMediaContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva escena' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la escena' }), { target: { value: 'Mi ventana' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Contenido de la escena' }));
    fireEvent.click(screen.getByRole('option', { name: 'Pantalla, ventana o pestaña' }));
    expect(screen.queryByRole('textbox', { name: 'Nombre de la fuente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar escena' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular fuente' }));
    expect(await screen.findByRole('img', { name: 'Fuente ligada: ChatGPT' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar escena' }));
    await screen.findByRole('button', { name: 'Mostrar escena Mi ventana' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Compartir pantalla' }));
    await waitFor(() => expect(shareBinding).toHaveBeenCalledWith(capture.id));
    expect(choose).toHaveBeenCalledOnce(); expect(stage()).not.toHaveTextContent('Learning no confirmó');
  });
  it('rechaza tipos y tamaños no admitidos y libera las URLs al quitar y desmontar', () => {
    const create = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const revoke = vi.fn(); vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const view = renderHook(() => useStudioScenes());
    const draft = { name: 'Imagen', kind: 'media' as const, title: 'Imagen', description: '', file: new File(['svg'], 'imagen.svg', { type: 'image/svg+xml' }) };
    let error: string | null | Promise<string | null> = null;
    act(() => { error = view.result.current.addScene(draft); });
    expect(error).toContain('PNG'); expect(create).not.toHaveBeenCalled();
    const large = new File(['png'], 'grande.png', { type: 'image/png' }); Object.defineProperty(large, 'size', { value: 26 * 1024 * 1024 });
    act(() => { error = view.result.current.addScene({ ...draft, file: large }); });
    expect(error).toContain('25 MB');
    act(() => { error = view.result.current.addScene({ ...draft, file: new File(['png'], 'imagen.png', { type: 'image/png' }) }); });
    expect(error).toBeNull(); expect(view.result.current.activeScene?.assetUrl).toBe('blob:first');
    const id = view.result.current.activeScene!.id;
    act(() => { view.result.current.removeScene(id); }); expect(revoke).toHaveBeenCalledWith('blob:first');
    act(() => { view.result.current.addScene({ ...draft, file: new File(['mp4'], 'video.mp4', { type: 'video/mp4' }) }); });
    expect(view.result.current.activeScene?.kind).toBe('video');
    view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:second'); expect(revoke).toHaveBeenCalledTimes(2);
  });
  it('limita escenas y evita nombres duplicados', () => {
    const view = renderHook(() => useStudioScenes(Array.from({ length: 12 }, (_, index) => ({ id: `${index}`, name: `Escena ${index}`, kind: 'slide' as const, title: 'Título', description: '' }))));
    let error: string | null | Promise<string | null> = null;
    const draft = { name: 'Nueva', kind: 'slide' as const, title: '', description: '', file: null };
    act(() => { error = view.result.current.addScene(draft); }); expect(error).toContain('12 escenas');
    act(() => { view.result.current.removeScene('0'); });
    act(() => { error = view.result.current.addScene({ ...draft, name: 'escena 1' }); }); expect(error).toContain('ese nombre');
  });
});
