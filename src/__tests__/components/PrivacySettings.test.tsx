import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacySettings } from '../../components/PrivacySettings';
const { service } = vi.hoisted(() => ({ service: { isAvailable: () => true, getStatus: vi.fn(), setPrivacyConfig: vi.fn() } }));
vi.mock('../../services/python-tools-service', () => ({ pythonToolsService: service }));
const state = (enabled = false) => ({ success: true, status: { available: false, running: false, lastError: null, privacy: { redactDocuments: enabled } } });
beforeEach(() => { vi.clearAllMocks(); service.getStatus.mockResolvedValue(state()); });
describe('Preferencia documental observable', () => {
  it('permite guardar protección sin runtime y explica sus límites', async () => {
    service.setPrivacyConfig.mockResolvedValueOnce({ success: true }); render(<PrivacySettings />);
    const toggle = await screen.findByRole('checkbox'); expect(toggle).not.toBeDisabled();
    expect(screen.getByText(/Puede omitir datos personales/)).toBeInTheDocument();
    fireEvent.click(toggle); await waitFor(() => expect(service.setPrivacyConfig).toHaveBeenCalledWith({ redactDocuments: true }));
    expect(await screen.findByRole('status')).toHaveTextContent('Preferencia guardada');
  });
  it('una configuración ilegible no aparece como protección desactivada', async () => {
    service.getStatus.mockResolvedValueOnce({ success: false, error: 'Configuración inválida.' }); render(<PrivacySettings />);
    expect(await screen.findByRole('status')).toHaveTextContent('Configuración inválida.'); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar cargar privacidad' })); expect(await screen.findByRole('checkbox')).not.toBeChecked();
  });
  it('un guardado sin confirmar conserva el estado real leído de main', async () => {
    service.setPrivacyConfig.mockResolvedValueOnce({ success: false, uncertain: true, error: 'Guardado sin confirmar.' }); render(<PrivacySettings />);
    fireEvent.click(await screen.findByRole('checkbox')); expect(await screen.findByRole('status')).toHaveTextContent('Guardado sin confirmar.');
    await waitFor(() => expect(service.getStatus).toHaveBeenCalledTimes(2)); expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
  it('descarta una carga que termina después de desmontar', async () => {
    let finish!: (value: ReturnType<typeof state>) => void; service.getStatus.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const view = render(<PrivacySettings />); view.unmount(); await act(async () => { finish(state(true)); }); expect(service.setPrivacyConfig).not.toHaveBeenCalled();
  });
});
