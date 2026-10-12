import { describe, expect, it, vi } from 'vitest';
import { exposeLearningLiveApi } from '../preload/learning-live-api';
import { ALLOWED_IPC_CHANNELS } from '../preload/channels';
import type { SafeIpc } from '../preload/types';
import type { WorkspaceOperation } from '../../src/shared/learning-workspace.contract';

describe('contrato preload de clases Learning', () => {
  it('expone solo apertura consulta y suscripción con canales permitidos', async () => {
    const bridge = { exposeInMainWorld: vi.fn() };
    const ipc = { safeInvoke: vi.fn(), safeOn: vi.fn(() => () => {}) } as unknown as SafeIpc;
    exposeLearningLiveApi(bridge, ipc);
    const api = bridge.exposeInMainWorld.mock.calls[0][1] as {
      catalog: (request: { organization_slug: string; page: number }) => Promise<unknown>;
      open: (ref: { organization_slug: string; session_id: string }) => Promise<unknown>;
      workspace: (ref: { organization_slug: string; session_id: string }, operation: WorkspaceOperation) => Promise<unknown>;
      getPending: () => Promise<unknown>; onRequested: (cb: () => void) => () => void;
    };
    const ref = { organization_slug: 'acme', session_id: '00000000-0000-4000-8000-000000000031' };
    await api.open(ref); await api.getPending(); api.onRequested(() => {});
    await api.workspace(ref, { type: 'snapshot' });
    await api.catalog({ organization_slug: 'acme', page: 0 });
    expect(ipc.safeInvoke).toHaveBeenCalledWith('learning-live:catalog', { organization_slug: 'acme', page: 0 });
    expect(ipc.safeInvoke).toHaveBeenCalledWith('learning-live:workspace', { ...ref, operation: { type: 'snapshot' } });
    expect(ipc.safeInvoke).toHaveBeenCalledWith('learning-live:open', ref);
    for (const channel of ['learning-live:open', 'learning-live:workspace', 'learning-live:catalog', 'app:get-pending-learning-session', 'app:learning-session'])
      expect(ALLOWED_IPC_CHANNELS).toContain(channel);
  });
});
