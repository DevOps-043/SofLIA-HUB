import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectHubApi } from '../../services/project-hub-api';
import { useProjectFileDownload } from '../../components/project-hub/useProjectFileDownload';
import type { ProjectDownloadResult } from '../../shared/project-hub-files';

const ID = '12345678-1234-4123-8123-123456789012';
let resolve!: (result: ProjectDownloadResult) => void;
let download: ReturnType<typeof vi.fn>, cancel: ReturnType<typeof vi.fn>;
beforeEach(() => {
  download = vi.fn(() => new Promise<ProjectDownloadResult>(accept => { resolve = accept; })); cancel = vi.fn(async () => ({ success: true }));
  Object.assign(window, { projectHubApi: { downloadFile: download, cancelDownload: cancel } });
});
afterEach(() => { cleanup(); delete (window as Window & { projectHubApi?: unknown }).projectHubApi; vi.restoreAllMocks(); });
describe('Descarga renderer sin rutas/bytes/URL', () => {
  it('wrapper sólo envía IDs y conserva copia guardada con cancelación tardía', async () => {
    const pending = projectHubApi.downloadFile(ID, ID, ID, ID); resolve({ success: false, cancelled: true, recoveryRequired: true, data: { saved: true, bytes: 4 } });
    expect(await pending).toMatchObject({ data: { saved: true } });
    expect(download).toHaveBeenCalledExactlyOnceWith({ workspaceId: ID, projectId: ID, evidenceId: ID, operationId: ID });
  });
  it('cancelación usa el mismo id sin duplicar descarga', async () => {
    const hook = renderHook(() => useProjectFileDownload(ID, ID)); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.download(ID); }); const operationId = download.mock.calls[0][0].operationId;
    await act(() => hook.result.current.cancel()); expect(cancel).toHaveBeenCalledWith({ operationId }); expect(download).toHaveBeenCalledOnce();
    await act(async () => { resolve({ success: false, cancelled: true, data: { saved: false, bytes: 0 } }); await pending; });
    expect(hook.result.current.message).toContain('No se guardó'); expect(hook.result.current.busy).toBe(false);
  });
  it('cambio de proyecto cancela y descarta el resultado anterior', async () => {
    const hook = renderHook(({ projectId }) => useProjectFileDownload(ID, projectId), { initialProps: { projectId: ID } }); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.download(ID); }); hook.rerender({ projectId: 'otro-proyecto' });
    expect(cancel).toHaveBeenCalledOnce(); expect(hook.result.current.busy).toBe(false);
    await act(async () => { resolve({ success: true, data: { saved: true, bytes: 4 } }); await pending; }); expect(hook.result.current.message).toBe('');
  });
  it('desmontar cancela sin reponer estado por respuesta tardía', async () => {
    const hook = renderHook(() => useProjectFileDownload(ID, ID)); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.download(ID); }); hook.unmount(); expect(cancel).toHaveBeenCalledOnce();
    resolve({ success: false, cancelled: true }); await pending;
  });
  it('explica la copia ya publicada aunque la cancelación sea posterior', async () => {
    const hook = renderHook(() => useProjectFileDownload(ID, ID)); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.download(ID); });
    await act(async () => { resolve({ success: false, cancelled: true, recoveryRequired: true, data: { saved: true, bytes: 4 } }); await pending; });
    expect(hook.result.current.message).toContain('se guardó antes'); expect(hook.result.current.message).not.toContain('No se guardó');
  });
  it('publicación incierta prevalece sobre cancelación sin afirmar ausencia de copia', async () => {
    const hook = renderHook(() => useProjectFileDownload(ID, ID)); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.download(ID); });
    await act(async () => { resolve({ success: false, cancelled: true, uncertain: true, recoveryRequired: true, data: { saved: false, bytes: 0 } }); await pending; });
    expect(hook.result.current.message).toContain('No se confirmó'); expect(hook.result.current.message).not.toContain('No se guardó');
  });
});
