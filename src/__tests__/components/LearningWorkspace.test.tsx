import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningWorkspace } from '../../components/learning-live/LearningWorkspace';

const calls = vi.hoisted(() => ({ workspace: vi.fn(), open: vi.fn() }));
vi.mock('../../services/learning-live-service', () => ({ learningLiveService: calls }));
beforeEach(() => vi.clearAllMocks());
const reference = { organization_slug: 'acme', session_id: '00000000-0000-4000-8000-000000000031' };

describe('lienzo vacío del aula', () => {
  it('no carga colaboración ni abre Zoom y permite volver o cerrar', () => {
    const back = vi.fn(), close = vi.fn();
    render(<LearningWorkspace onBackToSessions={back} onClose={close} />);
    expect(screen.getByRole('region', { name: 'Espacio de la sesión' })).toBeEmptyDOMElement();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Volver a mis sesiones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aula' }));
    expect(back).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(calls.workspace).not.toHaveBeenCalled();
    expect(calls.open).not.toHaveBeenCalled();
  });
  it('muestra el estudio solo con can_manage confirmado y no abre medios', async () => {
    calls.workspace.mockResolvedValue({ success: true, snapshot: { can_manage: true, session: { title: 'Clase autorizada' } } });
    render(<LearningWorkspace reference={reference} onBackToSessions={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByRole('region', { name: 'Estudio del instructor' })).toBeInTheDocument();
    expect(calls.workspace).toHaveBeenCalledWith(reference, { type: 'snapshot' });
    expect(calls.open).not.toHaveBeenCalled();
  });
  it('mantiene al participante fuera del estudio y ofrece reintento ante un fallo de autorización', async () => {
    calls.workspace.mockResolvedValueOnce({ success: false, error: 'Acceso no disponible' }).mockResolvedValueOnce({ success: true, snapshot: { can_manage: false, session: { title: 'Clase del participante' } } });
    render(<LearningWorkspace reference={reference} onBackToSessions={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso no disponible');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Espacio de la sesión' })).toBeEmptyDOMElement());
    expect(screen.queryByRole('region', { name: 'Estudio del instructor' })).not.toBeInTheDocument();
  });
});
