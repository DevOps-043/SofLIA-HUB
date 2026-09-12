import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRuntimeSupportPanel } from '../../components/browser/BrowserRuntimeSupportPanel';
import { integratedBrowserService, type BrowserDiagnosticExportResponse, type BrowserRuntimeDiagnosticResponse } from '../../services/integrated-browser-service';

vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { getRuntimeDiagnostic: vi.fn(), getProfile: vi.fn(), setProfile: vi.fn(), exportRuntimeDiagnostic: vi.fn() } }));
const diagnostic = { appVersion: '0.9.8', electronVersion: '43.4.0', chromiumVersion: '150.0.7871.224', nodeVersion: '24.18.1', profileKind: 'authenticated' as const, protectionLevel: 'off' as const, managed: false, checkedAt: new Date(0).toISOString() };
const profile = { id: 'perfil-prueba', kind: 'authenticated' as const, label: 'Perfil autenticado', persistent: true, managed: false };

beforeEach(() => {
  vi.mocked(integratedBrowserService.getRuntimeDiagnostic).mockReset().mockResolvedValue({ success: true, diagnostic });
  vi.mocked(integratedBrowserService.getProfile).mockReset().mockResolvedValue({ success: true, profile });
  vi.mocked(integratedBrowserService.setProfile).mockReset().mockResolvedValue({ success: true, profile });
  vi.mocked(integratedBrowserService.exportRuntimeDiagnostic).mockReset().mockResolvedValue({ success: true, diagnosticExport: { cancelled: false, exported: true } });
});

describe('soporte local del navegador', () => {
  it('explica el alcance y sólo exporta tras el gesto; permite actualizar versiones', async () => {
    render(<BrowserRuntimeSupportPanel />);
    expect(await screen.findByText('43.4.0')).toBeInTheDocument();
    expect(screen.getByText(/Sin URLs, historial/)).toBeInTheDocument();
    expect(integratedBrowserService.exportRuntimeDiagnostic).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar diagnóstico JSON' }));
    expect(await screen.findByText('Diagnóstico guardado. No se envió a ningún servidor.')).toBeInTheDocument();
    expect(integratedBrowserService.exportRuntimeDiagnostic).toHaveBeenCalledWith();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar diagnóstico' }));
    await waitFor(() => expect(integratedBrowserService.getRuntimeDiagnostic).toHaveBeenCalledTimes(2));
  });

  it('un fallo inicial permite reintentar sin rechazo de promesa sin manejar', async () => {
    vi.mocked(integratedBrowserService.getRuntimeDiagnostic).mockImplementationOnce(() => { throw new Error('fallo síncrono del puente'); });
    render(<BrowserRuntimeSupportPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Vuelve a intentarlo');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar diagnóstico' }));
    expect(await screen.findByText('43.4.0')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mantiene botones ocupados y no informa éxito al cancelar', async () => {
    let resolve!: (value: BrowserDiagnosticExportResponse) => void;
    vi.mocked(integratedBrowserService.exportRuntimeDiagnostic).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<BrowserRuntimeSupportPanel />); await screen.findByText('43.4.0');
    const button = screen.getByRole('button', { name: 'Exportar diagnóstico JSON' });
    fireEvent.click(button); fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Esperando confirmación…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Actualizar diagnóstico' })).toBeDisabled();
    expect(integratedBrowserService.exportRuntimeDiagnostic).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ success: true, diagnosticExport: { cancelled: true, exported: false } }); });
    expect(screen.queryByText(/Diagnóstico guardado/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar diagnóstico JSON' })).toBeEnabled();
  });

  it.each(['response', 'throw', 'missing'])('muestra fallo exportando y permite reintentar: %s', async (kind) => {
    if (kind === 'response') vi.mocked(integratedBrowserService.exportRuntimeDiagnostic).mockResolvedValueOnce({ success: false, error: 'No se pudo guardar' });
    if (kind === 'throw') vi.mocked(integratedBrowserService.exportRuntimeDiagnostic).mockRejectedValueOnce(new Error('fallo del puente'));
    if (kind === 'missing') vi.mocked(integratedBrowserService.exportRuntimeDiagnostic).mockResolvedValueOnce({ success: true });
    render(<BrowserRuntimeSupportPanel />); await screen.findByText('43.4.0');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar diagnóstico JSON' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo');
    expect(screen.queryByText(/Diagnóstico guardado/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar diagnóstico JSON' }));
    expect(await screen.findByText(/Diagnóstico guardado/)).toBeInTheDocument();
  });

  it.each(['loading', 'error'] as const)('muestra bloqueo mientras la verificación empresarial está en %s', async (status) => {
    vi.mocked(integratedBrowserService.getRuntimeDiagnostic).mockResolvedValueOnce({ success: true, diagnostic: { ...diagnostic, enterprisePolicyStatus: status } });
    render(<BrowserRuntimeSupportPanel />);
    expect(await screen.findByText(status === 'loading' ? 'Pendiente: acceso bloqueado' : 'Error: acceso bloqueado')).toBeInTheDocument();
    expect(screen.queryByText('Verificada')).not.toBeInTheDocument();
  });

  it('no ofrece exportar el perfil invitado', async () => {
    vi.mocked(integratedBrowserService.getRuntimeDiagnostic).mockResolvedValueOnce({ success: true, diagnostic: { ...diagnostic, profileKind: 'guest' } });
    render(<BrowserRuntimeSupportPanel />); await screen.findByText('Invitado');
    expect(screen.getByRole('button', { name: 'Exportar diagnóstico JSON' })).toBeDisabled();
  });

  it('no anuncia un cambio de perfil al cancelar la confirmación nativa', async () => {
    render(<BrowserRuntimeSupportPanel />); await screen.findByText('43.4.0');
    fireEvent.change(screen.getByRole('combobox', { name: 'Perfil de navegación' }), { target: { value: 'private' } });
    expect(await screen.findByText('Cambio cancelado. Se conserva el perfil actual.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Perfil de navegación' })).toHaveValue('authenticated');
    expect(screen.getByText(/aún pueden quedar archivos temporales/)).toBeInTheDocument();
  });

  it('actualiza el perfil sólo con el resultado confirmado por main', async () => {
    const privateProfile = { ...profile, kind: 'private' as const, label: 'Ventana privada', persistent: false };
    vi.mocked(integratedBrowserService.setProfile).mockResolvedValueOnce({ success: true, profile: privateProfile });
    render(<BrowserRuntimeSupportPanel />); await screen.findByText('43.4.0');
    vi.mocked(integratedBrowserService.getProfile).mockResolvedValue({ success: true, profile: privateProfile });
    fireEvent.change(screen.getByRole('combobox', { name: 'Perfil de navegación' }), { target: { value: 'private' } });
    expect(await screen.findByText(/Ventana privada activo/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Perfil de navegación' })).toBeEnabled());
    expect(screen.getByRole('combobox', { name: 'Perfil de navegación' })).toHaveValue('private');
  });

  it('descarta consultas tardías tras desmontar', async () => {
    let resolve!: (value: BrowserRuntimeDiagnosticResponse) => void;
    vi.mocked(integratedBrowserService.getRuntimeDiagnostic).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { unmount } = render(<BrowserRuntimeSupportPanel />); unmount();
    await act(async () => { resolve({ success: false, error: 'Error tardío' }); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
