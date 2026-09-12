import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserExtensionSiteAccess } from '../../components/browser/BrowserExtensionSiteAccess';
import { integratedBrowserService, type BrowserExtensionMetadata } from '../../services/integrated-browser-service';
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { restrictExtensionSites: vi.fn() } }));
const extension: BrowserExtensionMetadata = { installId: 'fixture', extensionId: null, name: 'Prueba', version: '1', permissions: [], hostPermissions: [], enabled: false, status: 'disabled', error: null };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(integratedBrowserService.restrictExtensionSites).mockResolvedValue({ success: true }); });
describe('permisos de extensión por sitio', () => {
  it('envía sólo selección explícita y explica la reinstalación y los puertos', async () => {
    const applied = vi.fn(async () => {});
    render(<BrowserExtensionSiteAccess extension={extension} onApplied={applied} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restringir sitios' }));
    expect(screen.getByText(/todos los puertos/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' https://example.com \n\nhttp://localhost' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar restricción' }));
    await waitFor(() => expect(applied).toHaveBeenCalledOnce());
    expect(integratedBrowserService.restrictExtensionSites).toHaveBeenCalledWith('fixture', ['https://example.com', 'http://localhost']);
  });
  it('no configura una extensión activa', () => {
    render(<BrowserExtensionSiteAccess extension={{ ...extension, enabled: true }} onApplied={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Restringir sitios' })).toBeDisabled();
  });
  it('conserva la selección y muestra rechazo sin publicar éxito', async () => {
    vi.mocked(integratedBrowserService.restrictExtensionSites).mockResolvedValue({ success: false, error: 'Cierra las páginas' });
    const applied = vi.fn(async () => {});
    render(<BrowserExtensionSiteAccess extension={extension} onApplied={applied} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restringir sitios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar restricción' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cierra las páginas');
    expect(applied).not.toHaveBeenCalled();
    expect(integratedBrowserService.restrictExtensionSites).toHaveBeenCalledWith('fixture', []);
  });
});
