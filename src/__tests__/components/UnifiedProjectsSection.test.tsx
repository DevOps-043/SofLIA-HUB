import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UnifiedProjectsSection } from '../../components/sidebar/UnifiedProjectsSection';
import { createDefaultProps } from './Sidebar.fixture';

const organizationA = '62beba2e-d36c-4b2e-a308-4885c53fd7d7';
const organizationB = 'c66c432f-1e7b-427c-8124-bef8f5ed053d';
const workspaceA = 'a12f1c01-e433-4f89-869a-8066d33654f3';
const workspaceB = 'b12f1c01-e433-4f89-869a-8066d33654f3';
const parent = { selectionId: 'c12f1c01-e433-4f89-869a-8066d33654f3', name: 'Proyectos', path: 'C:\\Proyectos', parentPath: 'C:\\', folders: [], truncated: false };
const project = { project_id: 'f8b9a999-7b76-4c4a-a7ce-3bb6dc7ee7f2', workspace_id: workspaceA, project_name: 'Proyecto API', project_key: 'API', completion_percentage: 0 };
function setup() {
  const bridge = {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { enabled: true, authenticated: true, workspaces: [{ id: workspaceA }, { id: workspaceB }] } }),
    retryAuthentication: vi.fn(),
    resolveOrganization: vi.fn().mockImplementation(({ organizationId }) => Promise.resolve({ success: true, data: { workspaceId: organizationId === organizationA ? workspaceA : workspaceB, name: 'Empresa Demo', role: 'owner' } })),
    listProjects: vi.fn().mockResolvedValue({ success: true, data: [] }),
    createConfigured: vi.fn().mockResolvedValue({ success: true, data: project }),
    selectFolder: vi.fn().mockResolvedValue({ success: true, data: parent }),
    cloudAccounts: vi.fn().mockResolvedValue({ success: true, data: [{ provider: 'google_drive', connected: true, email: 'demo@example.test', needsAuthorization: false }, { provider: 'onedrive', connected: true, email: 'demo@outlook.test', needsAuthorization: true }] }),
    cloudFolders: vi.fn().mockResolvedValue({ success: true, data: { provider: 'google_drive', selectionId: organizationB, name: 'Mi unidad', accountEmail: 'demo@example.test', breadcrumbs: [], folders: [] } }),
    authorizeCloud: vi.fn().mockResolvedValue({ success: true }),
    createCloudFolder: vi.fn().mockResolvedValue({ success: true, data: { provider: 'google_drive', selectionId: parent.selectionId, name: 'Nueva carpeta', accountEmail: 'demo@example.test' } }),
  };
  Object.assign(window, { projectHubApi: bridge });
  const props = createDefaultProps({ currentOrgId: organizationA, orgName: 'Empresa Demo', onOpenUnifiedProject: vi.fn() });
  return { bridge, props };
}
async function openCreator() {
  await waitFor(() => expect(screen.getByTitle('Crear proyecto')).toBeEnabled());
  fireEvent.click(screen.getByTitle('Crear proyecto'));
  return screen.getByRole('dialog', { name: 'Nuevo proyecto' });
}
async function chooseDrive() {
  await waitFor(() => expect(screen.getByRole('radio', { name: /Google Drive/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: /Google Drive/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Elegir carpeta de nube' }));
  const use = await screen.findByRole('button', { name: 'Usar esta carpeta' });
  await waitFor(() => expect(use).toBeEnabled());
  fireEvent.click(use);
}
afterEach(() => { vi.useRealTimers(); delete (window as Window & { projectHubApi?: unknown }).projectHubApi; });

describe('Creación de proyectos dentro de la aplicación', () => {
  it('un reintento explícito sin cambios conserva la operación tras rechazo confirmado', async () => {
    const { bridge, props } = setup();
    bridge.createConfigured.mockResolvedValueOnce({ success: false, error: 'Rechazo confirmado' });
    render(<UnifiedProjectsSection props={props} />); await openCreator();
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto API' } });
    fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta' }));
    await screen.findByRole('button', { name: 'Cambiar' });
    const submit = within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' });
    await waitFor(() => expect(submit).toBeEnabled()); fireEvent.click(submit);
    await screen.findByText('Rechazo confirmado');
    await waitFor(() => expect(submit).toBeEnabled()); fireEvent.click(submit);
    await waitFor(() => expect(bridge.createConfigured).toHaveBeenCalledTimes(2));
    expect(bridge.createConfigured.mock.calls[0][0]).toEqual(bridge.createConfigured.mock.calls[1][0]);
  });
  it('deshabilita proveedores sin sesión y explica cómo continuar', async () => {
    const { bridge, props } = setup();
    bridge.cloudAccounts.mockResolvedValue({ success: true, data: [] });
    render(<UnifiedProjectsSection props={props} />); await openCreator();
    await screen.findAllByText('Inicia sesión para continuar');
    expect(screen.getByRole('radio', { name: /Google Drive/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /OneDrive/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /En mi equipo/ })).toBeEnabled();
    expect(bridge.cloudFolders).not.toHaveBeenCalled();
  });
  it('crea una carpeta desde el selector de nube y entra en ella', async () => {
    const { bridge, props } = setup();
    render(<UnifiedProjectsSection props={props} />); await openCreator();
    await waitFor(() => expect(screen.getByRole('radio', { name: /Google Drive/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('radio', { name: /Google Drive/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Elegir carpeta de nube' }));
    const button = await screen.findByRole('button', { name: /Nueva carpeta/ });
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    fireEvent.change(screen.getByLabelText('Nombre de la carpeta'), { target: { value: 'Referencias' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear carpeta' }));
    await waitFor(() => expect(bridge.createCloudFolder).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google_drive', selectionId: organizationB, name: 'Referencias' })));
    await waitFor(() => expect(bridge.cloudFolders).toHaveBeenLastCalledWith(expect.objectContaining({ selectionId: parent.selectionId })));
  });
  it('se reconecta cuando el proveedor vuelve a responder', async () => {
    vi.useFakeTimers();
    const { bridge, props } = setup();
    bridge.listProjects.mockResolvedValueOnce({ success: false, code: 'UNAVAILABLE', error: 'No se puede conectar con Project Hub.' }).mockResolvedValue({ success: true, data: [] });
    render(<UnifiedProjectsSection props={props} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByText(/No se puede conectar/)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando proyectos');
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(bridge.listProjects).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Aún no hay proyectos.')).toBeInTheDocument();
  });
  it('limita los reintentos automáticos y conserva el error persistente', async () => {
    vi.useFakeTimers();
    const { bridge, props } = setup();
    bridge.getStatus.mockResolvedValue({ success: false, code: 'SOFIA_SESSION_PENDING', error: 'Sesión pendiente' });
    render(<UnifiedProjectsSection props={props} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByText(/Sesión pendiente/)).toBeNull();
    for (const delay of [300, 1000, 3000]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
    }
    expect(bridge.getStatus).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('button', { name: /Sesión pendiente.*Reintentar/ })).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(bridge.getStatus).toHaveBeenCalledTimes(4);
    bridge.getStatus.mockResolvedValue({ success: true, data: { authenticated: true } });
    fireEvent.click(screen.getByRole('button', { name: /Sesión pendiente.*Reintentar/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('Aún no hay proyectos.')).toBeInTheDocument();
  });
  it('un rechazo real no entra en un bucle y desmontar cancela la recuperación', async () => {
    vi.useFakeTimers();
    const { bridge, props } = setup();
    bridge.getStatus.mockResolvedValueOnce({ success: false, code: 'IPC_DENIED', error: 'Acceso denegado' });
    const view = render(<UnifiedProjectsSection props={props} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText(/Acceso denegado/)).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(bridge.getStatus).toHaveBeenCalledTimes(1);
    bridge.getStatus.mockResolvedValue({ success: false, code: 'UNAVAILABLE', error: 'Sin conexión' });
    fireEvent.click(screen.getByRole('button', { name: /Acceso denegado/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(bridge.getStatus).toHaveBeenCalledTimes(2);
  });
  it('abre un diálogo fuera del lateral, sin selector workspace ni ventanas nuevas', async () => {
    const { props } = setup();
    const popup = vi.spyOn(window, 'open');
    const view = render(<aside data-testid="sidebar"><UnifiedProjectsSection props={props} /></aside>);
    const dialog = await openCreator();
    expect(view.getByTestId('sidebar')).not.toContainElement(dialog);
    expect(within(dialog).queryByText('Empresa Demo')).toBeNull();
    expect(within(dialog).queryByText(/Organización actual/)).toBeNull();
    expect(within(dialog).queryByText('Nube de Soflia')).toBeNull();
    expect(within(dialog).queryByLabelText('Workspace')).toBeNull();
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(popup).not.toHaveBeenCalled();
    popup.mockRestore();
  });
  it('crea en la organización activa con una carpeta elegida dentro del diálogo', async () => {
    const { bridge, props } = setup();
    render(<UnifiedProjectsSection props={props} />);
    await openCreator();
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto API' } });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta' }));
    await waitFor(() => expect(bridge.selectFolder).toHaveBeenCalled());
    expect(await screen.findByText('C:\\Proyectos\\Proyecto API')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' }));
    await waitFor(() => expect(bridge.createConfigured).toHaveBeenCalledWith(expect.objectContaining({ organizationId: organizationA, name: 'Proyecto API', storage: { mode: 'local', parentSelectionId: parent.selectionId }, additionalSelectionIds: [] })));
    await waitFor(() => expect(props.onOpenUnifiedProject).toHaveBeenCalledWith(workspaceA, project.project_id));
  });
  it('admite nube con carpetas adicionales sin copiarlas ni elegir carpeta principal', async () => {
    const { bridge, props } = setup();
    render(<UnifiedProjectsSection props={props} />);
    await openCreator();
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto nube' } });
    await chooseDrive();
    fireEvent.click(screen.getByRole('button', { name: /Añadir carpeta/ }));
    await waitFor(() => expect(bridge.selectFolder).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Quitar Proyectos' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' }));
    await waitFor(() => expect(bridge.createConfigured).toHaveBeenCalledWith(expect.objectContaining({ organizationId: organizationA, storage: { mode: 'google_drive', parentSelectionId: organizationB }, additionalSelectionIds: [parent.selectionId] })));
  });
  it('cambiar de organización cierra el diálogo y descarta una creación tardía', async () => {
    const { bridge, props } = setup();
    let finish!: (value: unknown) => void;
    bridge.createConfigured.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<UnifiedProjectsSection props={props} />);
    await openCreator();
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto API' } });
    await chooseDrive();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' }));
    view.rerender(<UnifiedProjectsSection props={{ ...props, currentOrgId: organizationB }} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => finish({ success: true, data: project }));
    expect(props.onOpenUnifiedProject).not.toHaveBeenCalled();
    await waitFor(() => expect(bridge.listProjects).toHaveBeenLastCalledWith({ workspaceId: workspaceB, search: undefined, cursor: undefined }));
  });
  it('sólo lista proyectos del workspace vinculado y bloquea una relación ausente', async () => {
    const { bridge, props } = setup();
    bridge.listProjects.mockResolvedValue({ success: true, data: [project, { ...project, project_id: 'ajeno', workspace_id: workspaceB, project_name: 'Privado de B' }] });
    const view = render(<UnifiedProjectsSection props={props} />);
    expect(await screen.findByText('Proyecto API')).toBeInTheDocument();
    expect(screen.queryByText('Privado de B')).toBeNull();
    expect(bridge.listProjects).toHaveBeenCalledTimes(1);
    bridge.resolveOrganization.mockResolvedValue({ success: false, error: 'Organización no disponible' });
    view.rerender(<UnifiedProjectsSection props={{ ...props, currentOrgId: organizationB }} />);
    await screen.findByText(/Organización no disponible/);
    expect(screen.getByTitle('Crear proyecto')).toBeDisabled();
  });
  it('conserva el formulario ante error conocido y bloquea repetición incierta', async () => {
    const { bridge, props } = setup();
    bridge.createConfigured.mockResolvedValue({ success: false, uncertain: true, recoveryRequired: true, error: 'Resultado incierto' });
    render(<UnifiedProjectsSection props={props} />);
    await openCreator();
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto API' } });
    await chooseDrive();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' }));
    await screen.findByRole('alert');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' })).toBeDisabled();
    expect(bridge.createConfigured).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Nombre del proyecto')).toHaveValue('Proyecto API');
  });
  it('cancelar no crea ni selecciona carpetas automáticamente', async () => {
    const { bridge, props } = setup();
    render(<UnifiedProjectsSection props={props} />);
    await openCreator();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bridge.createConfigured).not.toHaveBeenCalled();
    expect(bridge.selectFolder).not.toHaveBeenCalled();
  });
  it('cancelar el explorador nativo conserva el formulario y la carpeta anterior', async () => {
    const { bridge, props } = setup();
    render(<UnifiedProjectsSection props={props} />);
    await openCreator();
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Conservar borrador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta' }));
    await screen.findByRole('button', { name: 'Cambiar' });
    bridge.selectFolder.mockResolvedValueOnce({ success: false, cancelled: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar' })).toBeEnabled());
    expect(screen.getByLabelText('Nombre del proyecto')).toHaveValue('Conservar borrador');
    expect(screen.getByText('C:\\Proyectos')).toBeInTheDocument();
    expect(bridge.createConfigured).not.toHaveBeenCalled();
  });
  it('muestra la cuenta Microsoft y exige autorización de archivos antes de elegir OneDrive', async () => {
    const { bridge, props } = setup();
    render(<UnifiedProjectsSection props={props} />);
    await openCreator();
    fireEvent.click(screen.getByRole('radio', { name: /OneDrive/ }));
    expect(await screen.findByText('demo@outlook.test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Autorizar OneDrive' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elegir carpeta de nube' })).toBeNull();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Crear proyecto' })).toBeDisabled();
    expect(bridge.createConfigured).not.toHaveBeenCalled();
  });
});
