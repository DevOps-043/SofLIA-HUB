import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructorStudio } from '../../components/learning-live/instructor/InstructorStudio';
import { connectProgramOutput } from '../../services/studio-output';
import type { StudioOutputEvent } from '../../shared/studio-program';
import { useStudioProgram } from '../../components/learning-live/instructor/useStudioProgram';
import type { StudioPreparedScene } from '../../components/learning-live/instructor/studio-types';
import * as compositor from '../../services/studio-program-renderer';
import { studioCapture } from '../../services/studio-capture';
vi.mock('../../services/studio-output', () => ({ connectProgramOutput: vi.fn() }));
let notify: (event: StudioOutputEvent) => void;
const stop = vi.fn(), closeOutput = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  const context = { fillStyle: '', font: '', textAlign: '', fillRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 20 }) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: vi.fn(() => ({ getTracks: () => [{ stop }] })) });
  window.studioOutput = { open: vi.fn(), close: vi.fn(), onState: (callback) => { notify = callback; return vi.fn(); } };
  vi.mocked(connectProgramOutput).mockImplementation(async () => { notify({ state: 'ready' }); return closeOutput; });
});
afterEach(() => { delete window.studioOutput; vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (HTMLCanvasElement.prototype as Partial<HTMLCanvasElement>).captureStream; });
const slide: StudioPreparedScene = { id: 'curso', name: 'Curso', kind: 'slide', title: 'Comenzamos', description: '' };
const image: StudioPreparedScene = { id: 'imagen', name: 'Identidad del curso', kind: 'image', title: '', description: '', assetUrl: 'blob:imagen' };
describe('preparación y programa del instructor', () => {
  it('mantiene un solo monitor y cambia de escena con un clic sin reiniciar la salida', async () => {
    render(<InstructorStudio onBack={vi.fn()} onClose={vi.fn()} examples={{ messages: [], resources: [], participants: 0, scenes: [slide, {...slide,id:'receso',name:'Receso',title:'Volvemos pronto'}] }} />);
    expect(screen.queryByRole('combobox', {name:'Efecto de transición'})).not.toBeInTheDocument();
    expect(screen.queryByText('Pantalla preparada.', {exact:false})).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Monitor de salida del curso')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name:'Activar salida'}));
    await screen.findByRole('button',{name:'Cerrar salida'});
    expect(screen.getByText('Salida local')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Mostrar escena Receso'}));
    await waitFor(() => expect(screen.getByRole('button',{name:'Mostrar escena Receso'})).toHaveAttribute('aria-pressed','true'));
    expect(connectProgramOutput).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:'Quitar escena Receso'}));
    expect(screen.getByText('Cambia primero la escena en programa antes de quitarla.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Cerrar salida'}));
    expect(closeOutput).toHaveBeenCalledOnce(); expect(stop).toHaveBeenCalledOnce();
  });
  it('permite crear una pantalla personalizada y rechaza un reloj fuera del límite', async () => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    render(<InstructorStudio onBack={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva escena' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la escena' }), { target: { value: 'Mi descanso' } });
    fireEvent.click(screen.getByRole('combobox', { name: 'Contenido de la escena' }));
    fireEvent.click(screen.getByRole('option', { name: 'Pantalla de curso con reloj' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Momento del curso' }), { target: { value: 'break' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Título de la lámina' }), { target: { value: 'Volvemos al taller en breve' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Cuenta regresiva en minutos' }), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar escena' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const stage = screen.getByRole('region', { name: 'Escenario seleccionado' });
    expect(within(stage).getByText('Volvemos al taller en breve')).toBeInTheDocument(); expect(stage).toHaveTextContent('07:00');
    expect(connectProgramOutput).not.toHaveBeenCalled();
  });
});

describe('fallos y cancelación de escenas en salida', () => {
  async function prepare() {
    const hook = renderHook(() => useStudioProgram());
    act(() => hook.result.current.bindCanvas(document.createElement('canvas')));
    // El canvas existe antes del efecto de montaje en el componente real.
    act(() => hook.result.current.stop());
    await act(() => hook.result.current.take(slide, true));
    return hook;
  }
  it('conserva el programa anterior si la nueva fuente falla', async () => {
    vi.spyOn(compositor, 'createMediaProgramSource').mockRejectedValue(new Error('No se pudo abrir el contenido.'));
    const hook=await prepare();
    await act(async () => { expect(await hook.result.current.take(image)).toBeUndefined(); });
    expect(hook.result.current.programScene?.id).toBe(slide.id);
    expect(hook.result.current.error).toBe('No se pudo abrir el contenido.');
    expect(connectProgramOutput).toHaveBeenCalledOnce(); hook.unmount();
  });
  it('ignora una imagen que acaba de cargar después de cerrar salida', async () => {
    let loaded: (source: compositor.ProgramSource) => void = () => {};
    vi.spyOn(compositor, 'createMediaProgramSource').mockImplementation(() => new Promise((resolve) => { loaded = resolve; }));
    const hook = await prepare();
    let change: Promise<unknown> = Promise.resolve();
    act(() => { change = hook.result.current.take(image); });
    await waitFor(() => expect(compositor.createMediaProgramSource).toHaveBeenCalledOnce());
    act(() => hook.result.current.stop());
    expect(vi.mocked(compositor.createMediaProgramSource).mock.calls[0][2]?.aborted).toBe(true);
    const late = { draw: vi.fn(), close: vi.fn() };
    await act(async () => { loaded(late); await change; });
    expect(late.close).toHaveBeenCalledOnce(); expect(hook.result.current.programScene).toBeNull(); expect(hook.result.current.state).toBe('idle');
    expect(connectProgramOutput).toHaveBeenCalledOnce(); hook.unmount();
  });
  it('una escena de pantalla requiere el vínculo autorizado y libera su captura al cerrar', async () => {
    const activate = vi.spyOn(studioCapture, 'activate').mockResolvedValue();
    const screenStop = vi.fn(), getDisplayMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: screenStop }] });
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });
    vi.spyOn(compositor, 'createMediaProgramSource').mockImplementation(async (_scene, stream) => ({ draw: vi.fn(), close: () => stream?.getTracks().forEach((track) => track.stop()) }));
    const bound: StudioPreparedScene = { ...image, id: 'pantalla', kind: 'screen', capture: { id: 'vinculo', name: 'Presentación', kind: 'window', thumbnail: null, withSystemAudio: false } };
    const hook = await prepare();
    let change: Promise<unknown> = Promise.resolve();
    act(() => { change = hook.result.current.take(bound); });
    await waitFor(() => expect(compositor.createMediaProgramSource).toHaveBeenCalledOnce());
    expect(activate).toHaveBeenCalledWith('vinculo', true); expect(getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false });
    act(() => hook.result.current.stop()); await act(() => change);
    expect(screenStop).toHaveBeenCalledOnce(); expect(hook.result.current.programScene).toBeNull(); hook.unmount();
  });
});
