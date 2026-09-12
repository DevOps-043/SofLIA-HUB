import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPolicyRecoveryPanel } from '../../components/browser/BrowserPolicyRecoveryPanel';
import { integratedBrowserService, type IntegratedBrowserState } from '../../services/integrated-browser-service';
import type { BrowserPolicyRecoveryResponse } from '../../shared/browser-policy-recovery';
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { getState: vi.fn(), getProfile: vi.fn(), recoverPolicyStore: vi.fn() } }));
const profile = { id: 'perfil', kind: 'authenticated' as const, label: 'Actual', persistent: true, managed: false };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(integratedBrowserService.getState).mockResolvedValue({ success: true, state: { profileRevision: 3 } as IntegratedBrowserState });
  vi.mocked(integratedBrowserService.getProfile).mockResolvedValue({ success: true, profile });
  vi.mocked(integratedBrowserService.recoverPolicyStore).mockResolvedValue({ success: true, cancelled: false, restored: 2 });
});
describe('recuperación explícita en soporte', () => {
  it('no accede a stores al montar, explica restricciones y envía sólo categoría/recibo', async () => {
    render(<BrowserPolicyRecoveryPanel profile={profile} />);
    expect(integratedBrowserService.getState).not.toHaveBeenCalled();
    expect(screen.getByText(/No restaura permisos concedidos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar privacidad' }));
    await waitFor(() => expect(integratedBrowserService.recoverPolicyStore).toHaveBeenCalledWith({ store: 'privacy', profileRevision: 3 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Recuperados 2 sitios');
  });
  it('privado e invitado no permiten recuperación persistente', () => {
    render(<BrowserPolicyRecoveryPanel profile={{ ...profile, kind: 'private' }} />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
  it('recuperar atajos sólo solicita su categoría e informa revisión sin ejecución', async () => {
    render(<BrowserPolicyRecoveryPanel profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar atajos' }));
    await waitFor(() => expect(integratedBrowserService.recoverPolicyStore).toHaveBeenCalledWith({ store: 'shortcuts', profileRevision: 3 }));
    expect(await screen.findByRole('status')).toHaveTextContent('no se ejecutó ningún atajo');
  });
  it('recuperar memoria no afirma haber restaurado fuentes ni contactado al proveedor', async () => {
    vi.mocked(integratedBrowserService.recoverPolicyStore).mockResolvedValueOnce({ success: true, restored: 0 });
    render(<BrowserPolicyRecoveryPanel profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar memoria semántica' }));
    await waitFor(() => expect(integratedBrowserService.recoverPolicyStore).toHaveBeenCalledWith({ store: 'semantic', profileRevision: 3 }));
    expect(await screen.findByRole('status')).toHaveTextContent('vacía y desactivada');
  });
  it.each([['history', 'historial'], ['audit', 'bitácora']])('recuperar %s usa recibo y comunica retención', async (store, label) => {
    render(<BrowserPolicyRecoveryPanel profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: `Recuperar ${label}` }));
    await waitFor(() => expect(integratedBrowserService.recoverPolicyStore).toHaveBeenCalledWith({ store, profileRevision: 3 }));
    expect(await screen.findByRole('status')).toHaveTextContent(`Recuperadas 2 entradas de ${label}`);
  });
  it.each(['cancelación', 'error', 'incompleto', 'conteo inválido'])('no informa éxito ante %s', async mode => {
    vi.mocked(integratedBrowserService.recoverPolicyStore).mockResolvedValueOnce(mode === 'cancelación' ? { success: true, cancelled: true } : mode === 'error' ? { success: false, error: 'No disponible' } : mode === 'conteo inválido' ? { success: true, restored: -1 } : { success: true });
    render(<BrowserPolicyRecoveryPanel profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar permisos por sitio' }));
    await waitFor(() => expect(integratedBrowserService.recoverPolicyStore).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText(/Revisando respaldo/)).not.toBeInTheDocument());
    expect(screen.queryByText(/Recuperados \d/)).not.toBeInTheDocument();
    if (mode === 'cancelación') expect(screen.getByRole('status')).toHaveTextContent('cancelada');
    else expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('perfil cambiado durante la consulta no prepara la recuperación', async () => {
    vi.mocked(integratedBrowserService.getProfile).mockResolvedValueOnce({ success: true, profile: { ...profile, id: 'otro' } });
    render(<BrowserPolicyRecoveryPanel profile={profile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar privacidad' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('perfil');
    expect(integratedBrowserService.recoverPolicyStore).not.toHaveBeenCalled();
  });
  it('evita doble solicitud y descarta acuse después de cambiar el perfil visible', async () => {
    let finish!: (value: BrowserPolicyRecoveryResponse) => void;
    vi.mocked(integratedBrowserService.recoverPolicyStore).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = render(<BrowserPolicyRecoveryPanel profile={profile} />);
    const button = screen.getByRole('button', { name: 'Recuperar privacidad' }); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(integratedBrowserService.recoverPolicyStore).toHaveBeenCalledOnce());
    view.rerender(<BrowserPolicyRecoveryPanel profile={{ ...profile, id: 'nuevo' }} />);
    await act(async () => finish({ success: true, restored: 2 }));
    expect(screen.queryByText(/Recuperados \d/)).not.toBeInTheDocument();
  });
});
