import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserSemanticMemoryPanel } from '../../components/browser/BrowserSemanticMemoryPanel';
import { integratedBrowserService, type IntegratedBrowserState } from '../../services/integrated-browser-service';
import type { BrowserSemanticResponse } from '../../shared/browser-semantic-memory';

vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { getState: vi.fn(), subscribe: vi.fn(), semanticMemoryCommand: vi.fn() } }));
const api = vi.mocked(integratedBrowserService); let receive: (state: IntegratedBrowserState) => void;
beforeEach(() => {
  vi.clearAllMocks();
  api.getState.mockResolvedValue({ success: true, state: { profileRevision: 2 } as IntegratedBrowserState });
  api.subscribe.mockImplementation(callbacks => { receive = callbacks.onStateChanged!; return vi.fn(); });
  api.semanticMemoryCommand.mockResolvedValue({ success: true, status: { enabled: true, count: 2, indexedAt: null, busy: false } });
});
describe('panel de memoria semántica', () => {
  it('no indexa al montar y delega consentimiento, consulta y citas explícitos', async () => {
    render(<BrowserSemanticMemoryPanel />);
    await waitFor(() => expect(screen.getByText('Consultar memoria')).toBeEnabled());
    expect(api.semanticMemoryCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Activar con consentimiento'));
    await waitFor(() => expect(api.semanticMemoryCommand).toHaveBeenCalledWith({ action: 'enable', profileRevision: 2 }));
    await waitFor(() => expect(screen.getByText('Reconstruir índice')).toBeEnabled());
    api.semanticMemoryCommand.mockResolvedValueOnce({ success: true, status: { enabled: true, count: 2, indexedAt: 1, busy: false }, results: [{ id: '1', source: 'bookmark', title: 'Astronomía', url: 'https://example.com/', score: 0.8 }] });
    fireEvent.change(screen.getByLabelText('Consulta semántica'), { target: { value: 'estrellas' } }); fireEvent.click(screen.getByText('Buscar'));
    expect(await screen.findByText('Marcador · Astronomía')).toBeInTheDocument();
    expect(api.semanticMemoryCommand).toHaveBeenLastCalledWith({ action: 'search', query: 'estrellas', profileRevision: 2 });
  });
  it('descarta respuestas de otro perfil y de una operación cancelada', async () => {
    render(<BrowserSemanticMemoryPanel />); await waitFor(() => expect(screen.getByText('Consultar memoria')).toBeEnabled());
    let finish!: (response: BrowserSemanticResponse) => void;
    api.semanticMemoryCommand.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByText('Consultar memoria'));
    act(() => receive({ profileRevision: 3 } as IntegratedBrowserState));
    await act(async () => finish({ success: true, results: [{ id: '1', source: 'history', title: 'Dato ajeno', url: 'https://example.com/', score: 1 }] }));
    expect(screen.queryByText(/Dato ajeno/)).not.toBeInTheDocument();
    api.semanticMemoryCommand.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByText('Consultar memoria'));
    api.semanticMemoryCommand.mockResolvedValueOnce({ success: true, canceled: true });
    fireEvent.click(screen.getByText('Cancelar operación'));
    expect(await screen.findByText(/Operación cancelada/)).toBeInTheDocument();
    await act(async () => finish({ success: true, status: { enabled: true, count: 99, indexedAt: null, busy: false } }));
    expect(screen.queryByText(/99 fuentes/)).not.toBeInTheDocument();
  });
  it('no anuncia borrado cuando se cancela la confirmación y presenta errores', async () => {
    render(<BrowserSemanticMemoryPanel />); await waitFor(() => expect(screen.getByText('Consultar memoria')).toBeEnabled());
    api.semanticMemoryCommand.mockResolvedValueOnce({ success: true, canceled: true });
    fireEvent.click(screen.getByText('Desactivar y borrar índice'));
    expect(await screen.findByText(/Operación cancelada/)).toBeInTheDocument();
    api.semanticMemoryCommand.mockRejectedValueOnce(new Error('falló'));
    fireEvent.click(screen.getByText('Consultar memoria'));
    expect(await screen.findByText('No se pudo completar la memoria.')).toBeInTheDocument();
  });
  it('permite cancelar una operación que continuó mientras el panel estaba cerrado', async () => {
    api.semanticMemoryCommand.mockResolvedValueOnce({ success: true, status: { enabled: true, count: 0, indexedAt: null, busy: true } });
    render(<BrowserSemanticMemoryPanel />); await waitFor(() => expect(screen.getByText('Consultar memoria')).toBeEnabled());
    fireEvent.click(screen.getByText('Consultar memoria'));
    expect(await screen.findByText('Cancelar operación')).toBeEnabled();
    expect(screen.getByText('Reconstruir índice')).toBeDisabled();
    api.semanticMemoryCommand.mockResolvedValueOnce({ success: true, canceled: true });
    fireEvent.click(screen.getByText('Cancelar operación'));
    expect(await screen.findByText(/Operación cancelada/)).toBeInTheDocument();
  });
});
