import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectHubApi } from '../../services/project-hub-api';
import { useProjectFileUpload } from '../../components/project-hub/useProjectFileUpload';
import type { ProjectUploadResult } from '../../shared/project-hub-files';

const ID = '12345678-1234-4123-8123-123456789012';
let resolve!: (result: ProjectUploadResult) => void;
let upload: ReturnType<typeof vi.fn>, cancel: ReturnType<typeof vi.fn>;
beforeEach(() => {
  upload = vi.fn(() => new Promise<ProjectUploadResult>(accept => { resolve = accept; })); cancel = vi.fn(async () => ({ success: true }));
  Object.assign(window, { projectHubApi: { uploadFiles: upload, cancelUpload: cancel } });
});
afterEach(() => { delete (window as Window & { projectHubApi?: unknown }).projectHubApi; vi.restoreAllMocks(); });
describe('Subida renderer sin bytes ni tokens', () => {
  it('wrapper envía sólo destino/id y conserva resultado parcial', async () => {
    const pending = projectHubApi.uploadFiles(ID, ID, ID);
    resolve({ success: false, partial: true, uncertain: true, data: { requested: 2, prepared: 2, stored: 1, uploaded: 1 } });
    expect(await pending).toMatchObject({ partial: true, uncertain: true }); expect(upload).toHaveBeenCalledExactlyOnceWith({ workspaceId: ID, projectId: ID, operationId: ID });
  });
  it('cancelar usa el mismo id sin repetir la selección', async () => {
    const hook = renderHook(() => useProjectFileUpload(ID, ID)); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.upload(); }); const operationId = upload.mock.calls[0][0].operationId;
    await act(() => hook.result.current.cancel()); expect(cancel).toHaveBeenCalledWith({ operationId }); expect(upload).toHaveBeenCalledOnce();
    await act(async () => { resolve({ success: false, cancelled: true }); await pending; }); expect(hook.result.current.busy).toBe(false);
  });
  it('cambiar proyecto cancela y descarta el resultado anterior', async () => {
    const hook = renderHook(({ projectId }) => useProjectFileUpload(ID, projectId), { initialProps: { projectId: ID } }); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.upload(); }); hook.rerender({ projectId: 'otro-proyecto' });
    expect(cancel).toHaveBeenCalledOnce(); expect(hook.result.current.busy).toBe(false);
    await act(async () => { resolve({ success: true, data: { requested: 1, prepared: 1, stored: 1, uploaded: 1 } }); await pending; });
    expect(hook.result.current.message).toBe(''); expect(hook.result.current.revision).toBe(0);
  });
  it('desmontar cancela y no repone estado por respuesta tardía', async () => {
    const hook = renderHook(() => useProjectFileUpload(ID, ID)); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.upload(); }); hook.unmount(); expect(cancel).toHaveBeenCalledOnce();
    resolve({ success: false, uncertain: true }); await pending;
  });
  it('un resultado parcial avisa revisar pendientes y refresca confirmados', async () => {
    const hook = renderHook(() => useProjectFileUpload(ID, ID)); let pending!: Promise<void>;
    act(() => { pending = hook.result.current.upload(); });
    await act(async () => { resolve({ success: false, partial: true, uncertain: true, recoveryRequired: true, data: { requested: 2, prepared: 2, stored: 1, uploaded: 1 } }); await pending; });
    expect(hook.result.current.message).toContain('1 archivo(s) confirmado(s)'); expect(hook.result.current.message).toContain('puede haber efectos'); expect(hook.result.current.revision).toBe(1);
  });
});
