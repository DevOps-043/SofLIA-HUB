import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { InstructorStudio } from '../../components/learning-live/instructor/InstructorStudio';
import { useStudioScenes } from '../../components/learning-live/instructor/useStudioScenes';
import type { StudioExamples } from '../../components/learning-live/instructor/studio-types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => vi.unstubAllGlobals());
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
  it('rechaza tipos y tamaños no admitidos y libera las URLs al quitar y desmontar', () => {
    const create = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const revoke = vi.fn(); vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const view = renderHook(() => useStudioScenes());
    const draft = { name: 'Imagen', kind: 'media' as const, title: 'Imagen', description: '', file: new File(['svg'], 'imagen.svg', { type: 'image/svg+xml' }) };
    let error: string | null = null;
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
    let error: string | null = null;
    const draft = { name: 'Nueva', kind: 'slide' as const, title: '', description: '', file: null };
    act(() => { error = view.result.current.addScene(draft); }); expect(error).toContain('12 escenas');
    act(() => { view.result.current.removeScene('0'); });
    act(() => { error = view.result.current.addScene({ ...draft, name: 'escena 1' }); }); expect(error).toContain('ese nombre');
  });
});
