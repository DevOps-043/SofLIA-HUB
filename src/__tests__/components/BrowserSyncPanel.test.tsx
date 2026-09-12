import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserSyncPanel } from '../../components/browser/BrowserSyncPanel';
vi.mock('../../components/browser/BrowserSyncControls', () => ({ BrowserSyncControls: () => null }));
import { integratedBrowserService, type BrowserSyncDevicesResponse } from '../../services/integrated-browser-service';
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { getSyncDevices: vi.fn(), registerSyncDevice: vi.fn(), revokeSyncDevice: vi.fn(), cancelSyncOperation: vi.fn(async () => ({ success: true })) } }));
const inactive = { enabled: true, state: 'inactive' as const, devices: [], message: 'Sin registro activo' };
const device = { id: '33333333-3333-4333-8333-333333333333', label: 'Este dispositivo', current: true, createdAt: '2026-09-08T00:00:00Z', revokedAt: null };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(integratedBrowserService.getSyncDevices).mockResolvedValue({ success: true, syncDevices: inactive }); });
describe('Panel de sincronización', () => {
  it('explica el alcance y no ofrece registro si está desactivado', async () => {
    vi.mocked(integratedBrowserService.getSyncDevices).mockResolvedValueOnce({ success: true, syncDevices: { ...inactive, enabled: false, state: 'disabled', message: 'Desactivada' } });
    render(<BrowserSyncPanel />); await screen.findByText('Desactivada');
    expect(screen.getByRole('button', { name: 'Registrar este dispositivo' })).toBeDisabled();
    expect(screen.getByText(/todavía no activa la transferencia/)).toBeInTheDocument();
    expect(screen.getByText(/contraseñas, cookies y passkeys/)).toBeInTheDocument();
  });
  it('cancelar confirmación no se anuncia como registro exitoso', async () => {
    vi.mocked(integratedBrowserService.registerSyncDevice).mockResolvedValueOnce({ success: true, syncDevices: { ...inactive, canceled: true } });
    render(<BrowserSyncPanel />); await screen.findByText('Sin registro activo');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar este dispositivo' }));
    await screen.findByText('No se confirmó la operación.');
    expect(screen.queryByRole('button', { name: 'Revocar Este dispositivo' })).not.toBeInTheDocument();
  });
  it('registra, lista y revoca mediante el resultado de main', async () => {
    vi.mocked(integratedBrowserService.registerSyncDevice).mockResolvedValueOnce({ success: true, syncDevices: { ...inactive, state: 'registered', devices: [device], message: 'Registrado sin transferir' } });
    vi.mocked(integratedBrowserService.revokeSyncDevice).mockResolvedValueOnce({ success: true, syncDevices: { ...inactive, message: 'Revocado' } });
    render(<BrowserSyncPanel />); await screen.findByText('Sin registro activo');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar este dispositivo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Revocar Este dispositivo' }));
    await screen.findByText('Revocado');
    expect(integratedBrowserService.revokeSyncDevice).toHaveBeenCalledWith(device.id);
    expect(screen.queryByText('Este dispositivo')).not.toBeInTheDocument();
  });
  it('ofrece cancelar y omite respuestas después de desmontar', async () => {
    let resolve!: (value: BrowserSyncDevicesResponse) => void;
    vi.mocked(integratedBrowserService.getSyncDevices).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const view = render(<BrowserSyncPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar operación' }));
    expect(integratedBrowserService.cancelSyncOperation).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => resolve({ success: true, syncDevices: { ...inactive, message: 'Respuesta obsoleta' } }));
    expect(screen.queryByText('Respuesta obsoleta')).not.toBeInTheDocument();
  });
  it('un error no habilita registro y permite consultar de nuevo', async () => {
    vi.mocked(integratedBrowserService.getSyncDevices).mockResolvedValueOnce({ success: false, error: 'Backend no disponible' });
    render(<BrowserSyncPanel />); await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Registrar este dispositivo' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar dispositivos' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar este dispositivo' })).toBeEnabled());
  });
  it('informa el rechazo de cancelación sin simular que terminó la operación', async () => {
    let resolve!: (value: BrowserSyncDevicesResponse) => void;
    vi.mocked(integratedBrowserService.getSyncDevices).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    vi.mocked(integratedBrowserService.cancelSyncOperation).mockResolvedValueOnce({ success: false, error: 'Rechazada' });
    render(<BrowserSyncPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar operación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo solicitar la cancelación.');
    expect(screen.getByRole('button', { name: 'Actualizar dispositivos' })).toBeDisabled();
    await act(async () => resolve({ success: true, syncDevices: inactive }));
    expect(screen.getByRole('button', { name: 'Actualizar dispositivos' })).toBeEnabled();
  });
});
