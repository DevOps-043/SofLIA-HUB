import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectFiles } from '../../components/project-workspace/ProjectFiles';
import { BrowserSaveToProject, SavePageDialog } from '../../components/browser/BrowserSaveToProject';

const authScope = vi.hoisted(() => ({ orgId: 'a12f1c01-e433-4f89-869a-8066d33654f3' }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'actor' }, sofiaContext: { currentOrganization: { id: authScope.orgId } } }) }));

const w = 'a12f1c01-e433-4f89-869a-8066d33654f3', p = 'b12f1c01-e433-4f89-869a-8066d33654f3';
const ok = (data: unknown) => ({ success: true, data });
let api: Record<string, ReturnType<typeof vi.fn>>;
const props = { workspaceId: w, projectId: p, canWrite: true, canManage: true, onRefresh: vi.fn(), onOpenWeb: vi.fn(), onOpenBrowser: vi.fn() };
beforeEach(() => {
  authScope.orgId = w;
  api = {
    locationFiles: vi.fn().mockResolvedValue(ok({ location: { mode: 'local', rootPath: 'C:\\Proyecto', additionalFolders: [] }, files: [{ id: 'nota.txt', name: 'nota.txt', size: 4 }], partial: false })),
    listDocuments: vi.fn().mockResolvedValue(ok([{ id: 'doc', name: 'Guía de marca', external_url: 'https://drive.google.com/file/d/guia/view', provider: 'google_drive' }])),
    listEvidence: vi.fn().mockResolvedValue(ok([{ evidence_id: 'web', evidence_type: 'link', title: 'Documentación web', external_reference: 'https://example.test/', metadata: { url: 'https://example.test/' } }, { evidence_id: 'file', evidence_type: 'upload', title: 'Archivo anterior' }])),
    cloudAccounts: vi.fn().mockResolvedValue(ok([{ provider: 'google_drive', connected: true }])),
    cloudFiles: vi.fn().mockResolvedValue(ok({ selectionId: w, name: 'Mi unidad', accountEmail: 'cuenta@example.test', breadcrumbs: [{ selectionId: w, name: 'Mi unidad' }], folders: [{ selectionId: p, name: 'Diseño' }], files: [{ selectionId: 'file-selection', name: 'Logo.png' }] })),
    linkCloudFile: vi.fn().mockResolvedValue(ok({})),
    previewLocationFile: vi.fn().mockResolvedValue(ok({ name: 'nota.txt', mimeType: 'text/plain', base64: btoa('Hola desde el proyecto · Revisión <script>contenido</script>') })),
    uploadLocationFiles: vi.fn().mockResolvedValue({ success: true, data: { uploaded: 1 } }),
    resolveOrganization: vi.fn().mockResolvedValue(ok({ workspaceId: w })),
    listProjects: vi.fn().mockResolvedValue(ok([{ project_id: p, workspace_id: w, project_name: 'Diseño Soflia', role: 'owner' }, { project_id: 'lector', project_name: 'Sólo lectura', role: 'viewer' }])),
    addEvidence: vi.fn().mockResolvedValue(ok({})),
  };
  Object.assign(window, { projectHubApi: api });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); delete (window as Window & { projectHubApi?: unknown }).projectHubApi; });
describe('Recursos unificados del proyecto', () => {
  it('un rechazo de almacenamiento no culpa al usuario ni presenta un éxito falso', async () => {
    api.addEvidence.mockResolvedValue({ success: false, code: 'DATABASE_FORBIDDEN', error: 'La base de datos no permite esta operación' });
    render(<BrowserSaveToProject title="Página" url="https://example.test/" projectTarget={{ workspaceId: w, projectId: p, organizationId: w, name: 'Soflia Hub', canWrite: true }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('status')).toHaveTextContent('El almacenamiento de este proyecto todavía no está habilitado');
    expect(screen.queryByText('Página guardada en Soflia Hub.')).toBeNull(); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('detecta el proyecto activo y guarda directamente sin abrir ni consultar el selector', async () => {
    const target = { workspaceId: w, projectId: p, organizationId: w, name: 'Soflia Hub', canWrite: true };
    render(<BrowserSaveToProject title="Página actual" url="https://example.test/guia" projectTarget={target} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar página en Soflia Hub' }));
    await waitFor(() => expect(api.addEvidence).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: w, projectId: p, evidence: expect.objectContaining({ title: 'Página actual' }) })));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Página guardada en Soflia Hub' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button')).toHaveClass('text-accent', 'bg-accent/15', 'disabled:opacity-100');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Página guardada en Soflia Hub.')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull(); expect(api.listProjects).not.toHaveBeenCalled(); expect(api.resolveOrganization).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('el indicador corresponde a la página guardada y no ilumina una URL distinta', async () => {
    const target = { workspaceId: w, projectId: p, organizationId: w, name: 'Soflia Hub', canWrite: true };
    const view = render(<BrowserSaveToProject title="Página" url="https://example.test/guardada" projectTarget={target} />);
    fireEvent.click(screen.getByRole('button'));
    await screen.findByRole('button', { name: 'Página guardada en Soflia Hub' });
    view.rerender(<BrowserSaveToProject title="Otra" url="https://example.test/otra" projectTarget={target} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button')).toBeEnabled();
    view.rerender(<BrowserSaveToProject title="Página" url="https://example.test/guardada" projectTarget={target} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(api.addEvidence).toHaveBeenCalledTimes(1);
  });
  it('fuera de un proyecto mantiene el selector y no escribe antes de seleccionar destino', async () => {
    render(<BrowserSaveToProject title="Página actual" url="https://example.test/guia" />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar página en un proyecto' }));
    await screen.findByRole('button', { name: 'Diseño Soflia' });
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(api.addEvidence).not.toHaveBeenCalled();
  });
  it('un guardado incierto no se reenvía ni se presenta como completado', async () => {
    api.addEvidence.mockResolvedValue({ success: false, uncertain: true, recoveryRequired: true });
    render(<BrowserSaveToProject title="Página" url="https://example.test/" projectTarget={{ workspaceId: w, projectId: p, organizationId: w, name: 'Soflia Hub', canWrite: true }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('status')).toHaveTextContent('Revisa las páginas del proyecto');
    expect(screen.getByRole('button')).toBeDisabled(); expect(api.addEvidence).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Página guardada en Soflia Hub.')).toBeNull();
  });
  it('un contexto de sólo lectura o de otra organización no habilita el guardado directo', () => {
    const target = { workspaceId: w, projectId: p, organizationId: w, name: 'Soflia Hub', canWrite: false };
    const view = render(<BrowserSaveToProject title="Página" url="https://example.test/" projectTarget={target} />);
    expect(screen.getByRole('button')).toBeDisabled();
    view.rerender(<BrowserSaveToProject title="Página" url="https://example.test/" projectTarget={{ ...target, canWrite: true, organizationId: p }} />);
    expect(screen.getByRole('button')).toBeDisabled(); expect(api.addEvidence).not.toHaveBeenCalled();
  });
  it('cambiar proyecto descarta el acuse tardío del destino anterior y no reenvía la página', async () => {
    let finish!: (result: unknown) => void;
    api.addEvidence.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const target = { workspaceId: w, projectId: p, organizationId: w, name: 'Proyecto A', canWrite: true };
    const view = render(<BrowserSaveToProject title="Página" url="https://example.test/" projectTarget={target} />);
    fireEvent.click(screen.getByRole('button'));
    view.rerender(<BrowserSaveToProject title="Página" url="https://example.test/" projectTarget={{ ...target, projectId: w, name: 'Proyecto B' }} />);
    await finish(ok({}));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.getByRole('button', { name: 'Guardar página en Proyecto B' })).toBeEnabled(); expect(api.addEvidence).toHaveBeenCalledTimes(1);
  });
  it('reúne archivos locales, Drive y cargas anteriores con una sola búsqueda y vista previa', async () => {
    render(<ProjectFiles {...props} kind="files" />);
    await screen.findByRole('button', { name: 'Vista previa de nota.txt' });
    expect(screen.getByRole('button', { name: 'Vista previa de Guía de marca' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vista previa de Archivo anterior' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar archivos y recursos')).toBeNull(); expect(screen.queryByText('Documentos y carpetas vinculados')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa de nota.txt' }));
    expect(await screen.findByText('Hola desde el proyecto · Revisión <script>contenido</script>')).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelector('script')).toBeNull();
    expect(api.previewLocationFile).toHaveBeenCalledWith({ workspaceId: w, projectId: p, fileId: 'nota.txt' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ventana' }));
    fireEvent.change(screen.getByLabelText('Buscar archivos'), { target: { value: 'marca' } });
    expect(screen.queryByRole('button', { name: 'Vista previa de nota.txt' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa de Guía de marca' }));
    expect(props.onOpenWeb).toHaveBeenCalledWith('https://drive.google.com/file/d/guia/view');
  });
  it('abre Drive sin pedir título ni URL y vincula la capacidad elegida', async () => {
    render(<ProjectFiles {...props} kind="files" />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Vincular Drive/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Vincular Drive/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Logo.png' }));
    expect(screen.queryByLabelText('Título')).toBeNull(); expect(screen.queryByLabelText('URL')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vincular archivo' }));
    await waitFor(() => expect(api.linkCloudFile).toHaveBeenCalledWith({ workspaceId: w, projectId: p, selectionId: 'file-selection' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('sin conexión deshabilita Drive y un lector no ve acciones de escritura', async () => {
    api.cloudAccounts.mockResolvedValue(ok([]));
    const view = render(<ProjectFiles {...props} kind="files" />); await screen.findByText(/Inicia sesión con Google/);
    expect(screen.getByRole('button', { name: /Vincular Drive/ })).toBeDisabled();
    view.rerender(<ProjectFiles {...props} kind="files" canWrite={false} canManage={false} />);
    expect(screen.queryByRole('button', { name: /Vincular Drive/ })).toBeNull(); expect(screen.queryByRole('button', { name: 'Añadir archivo' })).toBeNull();
  });
  it('un fallo de una fuente conserva los archivos de las otras y añadir usa el destino del proyecto', async () => {
    api.listDocuments.mockResolvedValue({ success: false, error: 'No se pudo consultar Drive' });
    render(<ProjectFiles {...props} kind="files" />); await screen.findByText('No se pudo consultar Drive');
    expect(screen.getByRole('button', { name: 'Vista previa de nota.txt' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir archivo' }));
    await waitFor(() => expect(api.uploadLocationFiles).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: w, projectId: p, operationId: expect.any(String) })));
  });
  it('muestra páginas guardadas sin buscador de archivos ni formulario de enlaces', async () => {
    render(<ProjectFiles {...props} kind="web" />); await screen.findByText('Documentación web');
    expect(screen.queryByRole('textbox')).toBeNull(); expect(screen.queryByRole('button', { name: 'Añadir enlace' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir navegador' })); expect(props.onOpenBrowser).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir página' })); expect(props.onOpenWeb).toHaveBeenCalledWith('https://example.test/');
  });
  it('guarda desde navegador sólo en un proyecto editable de la organización elegida, sin campos manuales', async () => {
    const onClose = vi.fn();
    render(<SavePageDialog organizationId={w} title="Guía de diseño" url="https://example.test/guia?token=privado" onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Diseño Soflia' }));
    expect(screen.queryByText('Sólo lectura')).toBeNull(); expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar página' }));
    await waitFor(() => expect(api.addEvidence).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: w, projectId: p, evidence: expect.objectContaining({ title: 'Guía de diseño', metadata: { url: 'https://example.test/guia', saved_from: 'browser' } }) })));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(screen.queryByText('Página guardada en Diseño Soflia.')).toBeNull();
  });
  it('al elegir proyecto cierra el selector e ilumina el icono sin mensaje', async () => {
    render(<BrowserSaveToProject title="Página" url="https://example.test/guia" />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar página en un proyecto' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Diseño Soflia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar página' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Página guardada en Diseño Soflia' })).toHaveAttribute('aria-pressed','true');
    expect(screen.queryByRole('status')).toBeNull();
  });
  it.each(['incierto', 'requiere revisión', 'error de transporte'])('el selector impide repetir un guardado con resultado %s', async outcome => {
    if (outcome === 'error de transporte') api.addEvidence.mockRejectedValue(new Error('Conexión interrumpida'));
    else api.addEvidence.mockResolvedValue({ success: false, uncertain: outcome === 'incierto', recoveryRequired: outcome === 'requiere revisión' });
    const onClose = vi.fn();
    render(<SavePageDialog organizationId={w} title="Página" url="https://example.test/guia" onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Diseño Soflia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar página' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Revisa las páginas del proyecto antes de repetir');
    const save = screen.getByRole('button', { name: 'Guardar página' });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(api.addEvidence).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
