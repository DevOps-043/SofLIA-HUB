import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserSitePermissionsPanel } from '../../components/browser/BrowserSitePermissionsPanel';
import { integratedBrowserService, type BrowserSitePermissionSummary } from '../../services/integrated-browser-service';

const site: BrowserSitePermissionSummary = {
  origin: 'https://meet.google.com',
  url: 'https://meet.google.com/abc',
  secure: true,
  permissions: [
    { kind: 'fullscreen', label: 'Pantalla completa', state: 'granted', requested: false },
    { kind: 'camera', label: 'Cámara', state: 'ask', requested: false },
    { kind: 'microphone', label: 'Micrófono', state: 'ask', requested: true },
    { kind: 'notifications', label: 'Notificaciones', state: 'denied', requested: false },
  ],
};

describe('BrowserSitePermissionsPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(integratedBrowserService, 'isAvailable').mockReturnValue(true);
    vi.spyOn(integratedBrowserService, 'getSitePermissions').mockResolvedValue({ success: true, site });
    vi.spyOn(integratedBrowserService, 'subscribe').mockReturnValue(() => {});
  });

  it('no renderiza nada mientras esta cerrado', () => {
    const { container } = render(<BrowserSitePermissionsPanel open={false} url={site.url} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(integratedBrowserService.getSitePermissions).not.toHaveBeenCalled();
  });

  it('muestra el origen, el estado de cada permiso y lo que la pagina solicito', async () => {
    render(<BrowserSitePermissionsPanel open url={site.url} onClose={vi.fn()} />);

    expect(await screen.findByText('meet.google.com')).toBeInTheDocument();
    expect(screen.getByText('La conexión es segura')).toBeInTheDocument();
    expect(screen.getByLabelText('Permiso de Micrófono')).toHaveValue('ask');
    expect(screen.getByText('Preguntar · lo solicitó esta página')).toBeInTheDocument();
    expect(screen.getByLabelText('Permiso de Notificaciones')).toHaveValue('denied');
    expect(screen.getByLabelText('Permiso de Pantalla completa')).toHaveValue('granted');
  });

  it('ordena primero lo que la pagina pidio', async () => {
    render(<BrowserSitePermissionsPanel open url={site.url} onClose={vi.fn()} />);

    const opciones = await screen.findAllByRole('combobox');
    expect(opciones[0]).toHaveAccessibleName('Permiso de Micrófono');
  });

  it('propaga el cambio de un permiso y adopta la respuesta del proceso principal', async () => {
    const actualizado: BrowserSitePermissionSummary = {
      ...site,
      permissions: site.permissions.map((entry) => (
        entry.kind === 'camera' ? { ...entry, state: 'granted' as const } : entry
      )),
    };
    const setSitePermission = vi.spyOn(integratedBrowserService, 'setSitePermission')
      .mockResolvedValue({ success: true, site: actualizado });
    render(<BrowserSitePermissionsPanel open url={site.url} onClose={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Permiso de Cámara'), { target: { value: 'granted' } });

    await waitFor(() => expect(setSitePermission).toHaveBeenCalledWith({ kind: 'camera', state: 'granted' }));
    await waitFor(() => expect(screen.getByLabelText('Permiso de Cámara')).toHaveValue('granted'));
  });

  it('muestra el motivo cuando el proceso principal rechaza el cambio', async () => {
    vi.spyOn(integratedBrowserService, 'setSitePermission').mockResolvedValue({
      success: false,
      error: 'El sistema tiene bloqueado el acceso a cámara.',
    });
    render(<BrowserSitePermissionsPanel open url={site.url} onClose={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText('Permiso de Cámara'), { target: { value: 'granted' } });

    expect(await screen.findByText('El sistema tiene bloqueado el acceso a cámara.')).toBeInTheDocument();
  });

  it('permite restablecer todos los permisos del origen', async () => {
    const reset = vi.spyOn(integratedBrowserService, 'resetSitePermissions')
      .mockResolvedValue({ success: true, site });
    render(<BrowserSitePermissionsPanel open url={site.url} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Restablecer permisos' }));

    await waitFor(() => expect(reset).toHaveBeenCalled());
  });

  it('invita a abrir una pagina cuando no hay origen administrable', async () => {
    vi.spyOn(integratedBrowserService, 'getSitePermissions').mockResolvedValue({
      success: true,
      site: { origin: null, url: 'about:blank', secure: false, permissions: [] },
    });
    render(<BrowserSitePermissionsPanel open url="about:blank" onClose={vi.fn()} />);

    expect(await screen.findByText('Abre una página web para administrar sus permisos.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
