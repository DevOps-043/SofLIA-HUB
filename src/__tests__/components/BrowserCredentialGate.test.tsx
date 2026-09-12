import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserCredentialGate } from '../../components/browser/BrowserCredentialGate';
import { integratedBrowserService, type IntegratedBrowserState } from '../../services/integrated-browser-service';
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { getState: vi.fn(), subscribe: vi.fn(), credentialSessionCommand: vi.fn() } }));
let listener: (state: IntegratedBrowserState) => void;
const state = (unlocked = false, profileRevision = 1) => ({ credentialUnlocked: unlocked, profileRevision } as IntegratedBrowserState);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(integratedBrowserService.getState).mockResolvedValue({ success: true, state: state() });
  vi.mocked(integratedBrowserService.subscribe).mockImplementation(callbacks => { listener = callbacks.onStateChanged!; return vi.fn(); });
  vi.mocked(integratedBrowserService.credentialSessionCommand).mockResolvedValue({ success: true, unlocked: true });
});
describe('barrera visual de bóveda', () => {
  it('no carga la biblioteca ni pide autenticación al abrir; requiere estado vigente', async () => {
    render(<BrowserCredentialGate><p>Biblioteca privada</p></BrowserCredentialGate>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desbloquear con Windows' })).toBeEnabled());
    expect(screen.queryByText('Biblioteca privada')).not.toBeInTheDocument();
    expect(integratedBrowserService.credentialSessionCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear con Windows' }));
    await waitFor(() => expect(integratedBrowserService.credentialSessionCommand).toHaveBeenCalledWith({ action: 'unlock', profileRevision: 1 }));
    expect(screen.queryByText('Biblioteca privada')).not.toBeInTheDocument();
    act(() => listener(state(true)));
    expect(screen.getByText('Biblioteca privada')).toBeInTheDocument();
    act(() => listener(state(false)));
    expect(screen.queryByText('Biblioteca privada')).not.toBeInTheDocument();
  });
  it('no aplica errores tardíos de otro perfil', async () => {
    let finish!: (result: { success: boolean; error: string }) => void;
    vi.mocked(integratedBrowserService.credentialSessionCommand).mockImplementation(() => new Promise(done => { finish = done; }));
    render(<BrowserCredentialGate><p>Biblioteca privada</p></BrowserCredentialGate>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desbloquear con Windows' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear con Windows' }));
    act(() => listener(state(false, 2)));
    await act(async () => finish({ success: false, error: 'Error anterior' }));
    expect(screen.queryByText('Error anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Biblioteca privada')).not.toBeInTheDocument();
  });
});
