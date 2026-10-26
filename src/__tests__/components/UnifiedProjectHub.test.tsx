import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedProjectHub } from '../../components/project-hub/UnifiedProjectHub';
import { projectHubApi } from '../../services/project-hub-api';
import type { ProjectDownloadResult } from '../../shared/project-hub-files';

vi.mock('../../services/project-hub-api', () => ({ projectHubApi: {
  getLocation: vi.fn(),
  locationFiles: vi.fn(),
  listDocuments: vi.fn(async()=>({success:true,data:[]})), getProject: vi.fn(), analytics: vi.fn(), listEvidence: vi.fn(), downloadFile: vi.fn(), cancelDownload: vi.fn(), cancelUpload: vi.fn(),
} }));
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: {} }));
const ID = '12345678-1234-4123-8123-123456789012';
const EVIDENCE = '22345678-1234-4123-8123-123456789012';
let resolve!: (result: ProjectDownloadResult) => void;
beforeEach(() => {
  vi.mocked(projectHubApi.getLocation).mockResolvedValue({ success: true, data: null });
  vi.mocked(projectHubApi.locationFiles).mockResolvedValue({ success: true, data: { location: null, files: [], partial: false } });
  vi.mocked(projectHubApi.getProject).mockResolvedValue({ success: true, data: { project_id: ID, workspace_id: ID, project_name: 'Proyecto inicial', project_key: 'PR', project_status: 'active', completion_percentage: 0 } } as Awaited<ReturnType<typeof projectHubApi.getProject>>);
  vi.mocked(projectHubApi.analytics).mockResolvedValue({ success: true, data: {} });
  vi.mocked(projectHubApi.listEvidence).mockResolvedValue({ success: true, data: [
    { evidence_id: EVIDENCE, evidence_type: 'upload', title: 'Archivo listo', created_at: '2026-10-22', metadata: { upload_state: 'ready' } },
    { evidence_id: 'pendiente', evidence_type: 'upload', title: 'Archivo pendiente', created_at: '2026-10-22', metadata: { upload_state: 'pending' } },
    { evidence_id: 'enlace', evidence_type: 'link', title: 'Enlace', created_at: '2026-10-22' },
  ] });
  vi.mocked(projectHubApi.downloadFile).mockImplementation(() => new Promise<ProjectDownloadResult>(accept => { resolve = accept; }));
  vi.mocked(projectHubApi.cancelDownload).mockResolvedValue({ success: true });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
async function openSources() {
  await screen.findByRole('heading', { name: 'Proyecto inicial' }); fireEvent.click(screen.getByRole('button', { name: 'Archivos' }));
  return screen.findByRole('button', { name: 'Guardar copia' });
}
describe('Fuentes Project Hub integradas', () => {
  it('ofrece copia sólo para uploads ready y cancela la operación pendiente al desmontar', async () => {
    const view = render(<UnifiedProjectHub workspaceId={ID} projectId={ID} />); fireEvent.click(await openSources());
    expect(screen.getAllByRole('button', { name: 'Guardar copia' })).toHaveLength(1);
    expect(projectHubApi.downloadFile).toHaveBeenCalledWith(ID, ID, EVIDENCE, expect.any(String));
    expect(screen.getByRole('button', { name: 'Guardar copia' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar descarga' }));
    await waitFor(() => expect(projectHubApi.cancelDownload).toHaveBeenCalledOnce());
    await act(async () => { resolve({ success: false, cancelled: true, recoveryRequired: true, data: { saved: true, bytes: 4 } }); });
    expect(screen.getByRole('status')).toHaveTextContent('se guardó antes');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar copia' })); view.unmount();
    expect(projectHubApi.cancelDownload).toHaveBeenCalledTimes(2); resolve({ success: false, cancelled: true });
  });
  it('cambiar destino retira lista y acción antiguas antes de cargar el nuevo proyecto', async () => {
    const view = render(<UnifiedProjectHub workspaceId={ID} projectId={ID} />); fireEvent.click(await openSources());
    vi.mocked(projectHubApi.getProject).mockImplementationOnce(() => new Promise(() => {}));
    view.rerender(<UnifiedProjectHub workspaceId={ID} projectId={EVIDENCE} />);
    expect(screen.getByText('Cargando proyecto…')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Guardar copia' })).toBeNull();
    expect(screen.queryByText('Archivo listo')).toBeNull(); expect(projectHubApi.cancelDownload).toHaveBeenCalledOnce();
    await act(async () => { resolve({ success: true, data: { saved: true, bytes: 4 } }); });
    expect(screen.getByRole('status')).toHaveTextContent('Cargando proyecto…');
  });
});
