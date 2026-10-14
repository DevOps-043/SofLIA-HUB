import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningWorkspace } from '../../components/learning-live/LearningWorkspace';
import { emptyStudioState } from '../../shared/live-studio-domain';
const studio = vi.fn(), watch = vi.fn(), unwatch = vi.fn();
const reference = { organization_slug: 'acme', session_id: '00000000-0000-4000-8000-000000000031' };
const snapshot = { session_id: reference.session_id, user_id: '00000000-0000-4000-8000-000000000011', title: 'Clase autorizada', can_manage: true, server_time: '2026-10-12T20:00:00Z', state: emptyStudioState(), asset_urls: {} };
beforeEach(() => {
  vi.clearAllMocks();
  studio.mockResolvedValue({ success: true, snapshot }); watch.mockResolvedValue({ success: true });
  window.learningLive = { studio, watchStudio: watch, unwatchStudio: unwatch, onStudioEvent: () => () => {}, workspace: vi.fn(), open: vi.fn(), getPending: async () => null, onRequested: () => () => {} };
});
afterEach(() => { delete window.learningLive; });
describe('acceso al estudio conectado', () => {
  it('conserva el lienzo vacío sin referencia y permite volver o cerrar', () => {
    const back = vi.fn(), close = vi.fn(); render(<LearningWorkspace onBackToSessions={back} onClose={close} />);
    expect(screen.getByRole('region', { name: 'Espacio de la sesión' })).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a mis sesiones' })); fireEvent.click(screen.getByRole('button', { name: 'Cerrar aula' }));
    expect(back).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce(); expect(studio).not.toHaveBeenCalled();
  });
  it('muestra el instructor solo tras confirmar el rol y no solicita acceso Zoom automático', async () => {
    const { unmount } = render(<LearningWorkspace reference={reference} onBackToSessions={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByRole('region', { name: 'Estudio del instructor' })).toBeInTheDocument();
    expect(studio).toHaveBeenCalledWith(reference, { type: 'snapshot' });
    expect(studio.mock.calls.some(([, operation]) => operation.type === 'zoom')).toBe(false);
    expect(window.learningLive?.workspace).not.toHaveBeenCalled(); unmount(); expect(unwatch).toHaveBeenCalled();
  });
  it('permite reintentar acceso y separa la vista del participante', async () => {
    studio.mockResolvedValueOnce({ success: false, code: 'access_denied', error: 'Acceso no disponible' }).mockResolvedValue({ success: true, snapshot: { ...snapshot, can_manage: false } });
    render(<LearningWorkspace reference={reference} onBackToSessions={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso no disponible'); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Aula del participante' })).toBeInTheDocument();
    expect(screen.queryByText('Acceso no disponible')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Estudio del instructor' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Moderar chat' })).toBeDisabled();
  });
  it('muestra la integración no publicada sin culpar a la cuenta y mantiene la navegación', async () => {
    studio.mockResolvedValue({success:false,code:'unavailable',error:'El estudio de Learning todavía no está habilitado para Soflia Hub.'});
    const back=vi.fn(),close=vi.fn();
    render(<LearningWorkspace reference={reference} onBackToSessions={back} onClose={close} />);
    expect(await screen.findByRole('heading',{name:'Tu aula aún no está disponible'})).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('todavía no está habilitado');
    fireEvent.click(screen.getByRole('button',{name:'Volver a mis sesiones'}));
    fireEvent.click(screen.getByRole('button',{name:'Cerrar aula'}));
    expect(back).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    expect(screen.queryByRole('region',{name:'Estudio del instructor'})).not.toBeInTheDocument();
  });
  it.each(['rol', 'sesión eliminada'])('descarta el grant anterior al cambiar %s', async (change) => {
    const listeners=new Set<(notice:unknown)=>void>();
    const invalidate=(notice:unknown)=>{for(const listener of [...listeners])listener(notice);};
    window.learningLive!.onStudioEvent = (callback) => { listeners.add(callback); return () => {listeners.delete(callback);}; };
    studio.mockImplementation(async (_ref, operation) => operation.type === 'zoom' ? {success:true,zoom:{meetingNumber:'123456789',signature:'firma-efimera',userName:'Instructor',password:''}} : {success:true,snapshot});
    render(<LearningWorkspace reference={reference} onBackToSessions={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button',{name:/^Conectar Zoom$/}));
    const frame = await screen.findByTitle('Reunión Zoom integrada') as HTMLIFrameElement;
    expect(frame).toBeInTheDocument();
    // JSDOM destruye el origen de la ventana hija antes del cleanup pasivo de React.
    vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
    studio.mockResolvedValue(change === 'rol' ? {success:true,snapshot:{...snapshot,can_manage:false,state:{...snapshot.state,revision:1}}} : {success:false,code:'access_denied',error:'Esta sesión ya no está disponible en tu organización.'});
    await act(async () => { invalidate({session_id:reference.session_id,status:'changed'}); });
    if (change === 'rol') expect(await screen.findByRole('region',{name:'Aula del participante'})).toBeInTheDocument();
    else expect(await screen.findByRole('alert')).toHaveTextContent('Esta sesión ya no está disponible');
    expect(screen.queryByTitle('Reunión Zoom integrada')).not.toBeInTheDocument();
  });
});
