import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserSyncControls } from '../../components/browser/BrowserSyncControls';
import { integratedBrowserService, type BrowserSyncControlStatus } from '../../services/integrated-browser-service';
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { controlSync: vi.fn(), cancelSyncOperation: vi.fn(async () => ({ success: true })) } }));
const status: BrowserSyncControlStatus = { enabled: true, keyAvailable: true, categories: [], lastSyncedAt: null, state: 'disabled', completed: [], initialCategories: [], conflicts: [] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(integratedBrowserService.controlSync).mockResolvedValue({ success: true, sync: status }); });
describe('Configuración selectiva de sync', () => {
  it.each(['confirmar', 'cancelar', 'fallar'] as const)('ofrece recuperar configuración aunque no pueda cargarla: %s', async mode => {
    vi.mocked(integratedBrowserService.controlSync).mockResolvedValueOnce({ success: false, error: 'Configuración dañada' });
    render(<BrowserSyncControls />); await screen.findByText('Configuración dañada');
    vi.mocked(integratedBrowserService.controlSync).mockResolvedValueOnce(mode === 'fallar' ? { success: false, error: 'No se pudo recuperar' }
      : { success: true, sync: { ...status, canceled: mode === 'cancelar' } });
    fireEvent.click(screen.getByText('Recuperar configuración dañada'));
    expect(integratedBrowserService.controlSync).toHaveBeenLastCalledWith({ action: 'recover-settings' });
    if (mode === 'confirmar') expect(await screen.findByText(/Configuración recuperada con transferencia desactivada/)).toBeInTheDocument();
    else if (mode === 'cancelar') expect(await screen.findByText('Operación no confirmada.')).toBeInTheDocument();
    else expect(await screen.findByText('No se pudo recuperar')).toBeInTheDocument();
  });
  it('consulta sin activar y envía sólo categorías elegidas', async () => {
    render(<BrowserSyncControls />); await screen.findByText('Sin categorías activas.');
    expect(integratedBrowserService.controlSync).toHaveBeenCalledWith({ action: 'status' });
    fireEvent.click(screen.getByLabelText('Marcadores')); fireEvent.click(screen.getByText('Aplicar categorías'));
    expect(integratedBrowserService.controlSync).toHaveBeenLastCalledWith({ action: 'configure', categories: ['bookmarks'] });
  });
  it('sin clave no habilita categorías y exportar no recibe ruta ni clave', async () => {
    vi.mocked(integratedBrowserService.controlSync).mockResolvedValueOnce({ success: true, sync: { ...status, keyAvailable: false } });
    render(<BrowserSyncControls />); await screen.findByText('Sin categorías activas.');
    expect(screen.getByLabelText('Marcadores')).toBeDisabled(); fireEvent.click(screen.getByText('Crear clave y guardar código'));
    expect(integratedBrowserService.controlSync).toHaveBeenLastCalledWith({ action: 'export-key' });
  });
  it('liga una elección a la revisión visible', async () => {
    vi.mocked(integratedBrowserService.controlSync).mockResolvedValueOnce({ success: true, sync: { ...status, categories: ['bookmarks'], state: 'conflict', conflicts: [{ category: 'bookmarks', count: 2, reviewId: 'a'.repeat(64) }] } });
    render(<BrowserSyncControls />); fireEvent.click(await screen.findByText('Preferir versiones remotas'));
    expect(integratedBrowserService.controlSync).toHaveBeenLastCalledWith({ action: 'resolve', category: 'bookmarks', reviewId: 'a'.repeat(64), choice: 'remote' });
  });
  it('descarta respuesta tardía y solicita cancelar al desmontar', async () => {
    let finish!: (value: { success: boolean; sync: BrowserSyncControlStatus }) => void;
    vi.mocked(integratedBrowserService.controlSync).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const view = render(<BrowserSyncControls />); await screen.findByText('Cancelar transferencia'); view.unmount();
    await act(async () => finish({ success: true, sync: { ...status, state: 'idle' } }));
    expect(screen.queryByText('Sincronización completada.')).not.toBeInTheDocument(); expect(integratedBrowserService.cancelSyncOperation).toHaveBeenCalled();
  });
});
