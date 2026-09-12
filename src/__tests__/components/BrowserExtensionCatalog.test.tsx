import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserExtensionCatalog } from '../../components/browser/BrowserExtensionCatalog';
import { integratedBrowserService, type BrowserExtensionMetadata } from '../../services/integrated-browser-service';
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { extensionCatalog: vi.fn() } }));
const entry = { id: 'chrome-reading-time', name: 'Lectura', publisher: 'Editor oficial', version: '1.0', revision: 'a'.repeat(40), sourceUrl: 'https://example.com/revision', description: 'Ejemplo limitado.' };
const extension: BrowserExtensionMetadata = { installId: 'a'.repeat(32), extensionId: null, name: 'Lectura', version: '1.0', permissions: [], hostPermissions: [], enabled: false, status: 'disabled', error: null, catalogId: entry.id };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(integratedBrowserService.extensionCatalog).mockResolvedValue({ success: true, catalog: [entry] }); });
describe('catálogo verificado de extensiones', () => {
  it('solicita revisión explícita por id, no descarga ni concede aprobación', async () => {
    const preview = { token: 'token', name: 'Lectura', version: '1.0', permissions: [], hostPermissions: [] };
    const onPreview = vi.fn(); render(<BrowserExtensionCatalog extensions={[]} onPreview={onPreview} />);
    const button = await screen.findByRole('button', { name: 'Verificar carpeta oficial' });
    expect(screen.getByRole('textbox')).toHaveValue(entry.sourceUrl);
    expect(screen.queryByRole('link')).toBeNull();
    vi.mocked(integratedBrowserService.extensionCatalog).mockResolvedValueOnce({ success: true, preview });
    fireEvent.click(button);
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(preview));
    expect(integratedBrowserService.extensionCatalog).toHaveBeenLastCalledWith({ action: 'prepare', catalogId: entry.id });
  });
  it('actualiza sólo una instalación deshabilitada y conserva el error sin éxito falso', async () => {
    const onPreview = vi.fn(); const view = render(<BrowserExtensionCatalog extensions={[{ ...extension, enabled: true }]} onPreview={onPreview} />);
    expect(await screen.findByRole('button', { name: 'Revisar actualización o reinstalación' })).toBeDisabled();
    view.rerender(<BrowserExtensionCatalog extensions={[extension]} onPreview={onPreview} />);
    vi.mocked(integratedBrowserService.extensionCatalog).mockResolvedValueOnce({ success: false, error: 'Carpeta no verificada' });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar actualización o reinstalación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Carpeta no verificada');
    expect(integratedBrowserService.extensionCatalog).toHaveBeenLastCalledWith({ action: 'prepare', catalogId: entry.id, updateInstallId: extension.installId });
    expect(onPreview).not.toHaveBeenCalled();
  });
  it('cancelar o desmontar durante una revisión no abre la confirmación', async () => {
    const onPreview = vi.fn(); const view = render(<BrowserExtensionCatalog extensions={[]} onPreview={onPreview} />);
    const button = await screen.findByRole('button', { name: 'Verificar carpeta oficial' });
    vi.mocked(integratedBrowserService.extensionCatalog).mockResolvedValueOnce({ success: true, canceled: true });
    fireEvent.click(button); await waitFor(() => expect(button).toBeEnabled());
    let finish!: (value: { success: true; preview: { token: string; name: string; version: string; permissions: string[]; hostPermissions: string[] } }) => void;
    vi.mocked(integratedBrowserService.extensionCatalog).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    fireEvent.click(button); view.unmount();
    finish({ success: true, preview: { token: 'token', name: 'Lectura', version: '1', permissions: [], hostPermissions: [] } });
    await Promise.resolve(); expect(onPreview).not.toHaveBeenCalled();
  });
});
