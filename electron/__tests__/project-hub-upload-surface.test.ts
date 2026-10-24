import { describe, expect, it, vi } from 'vitest';
import { exposeProjectHubApi } from '../preload/project-hub-api';
import { ALLOWED_IPC_CHANNELS } from '../preload/channels';

describe('Superficie de subida Project Hub sin secretos renderer', () => {
  it('no expone intenciones/tokens ni complete genérico al renderer', () => {
    let exposed: Record<string, unknown> = {};
    exposeProjectHubApi({ exposeInMainWorld: (_key, value) => { exposed = value as typeof exposed; } }, {
      safeInvoke: vi.fn(), safeSend: vi.fn(), safeOn: vi.fn(), safeRemoveAllListeners: vi.fn(), sanitizePayload: value => value, validateChannel: vi.fn(),
    });
    expect(exposed).not.toHaveProperty('createUploadIntent'); expect(exposed).not.toHaveProperty('completeUpload');
    expect(exposed.uploadFiles).toBeTypeOf('function'); expect(exposed.cancelUpload).toBeTypeOf('function');
  });
  it('retira de la allowlist las primitivas que devolvían token de subida', () => {
    expect(ALLOWED_IPC_CHANNELS).not.toContain('project-hub:create-upload-intent');
    expect(ALLOWED_IPC_CHANNELS).not.toContain('project-hub:complete-upload');
  });
  it('no expone URL firmada de descarga, sólo guardar/cancelar por IDs', () => {
    let exposed: Record<string, unknown> = {};
    exposeProjectHubApi({ exposeInMainWorld: (_key, value) => { exposed = value as typeof exposed; } }, {
      safeInvoke: vi.fn(), safeSend: vi.fn(), safeOn: vi.fn(), safeRemoveAllListeners: vi.fn(), sanitizePayload: value => value, validateChannel: vi.fn(),
    });
    expect(exposed).not.toHaveProperty('getDownload'); expect(ALLOWED_IPC_CHANNELS).not.toContain('project-hub:get-download');
    expect(exposed.downloadFile).toBeTypeOf('function'); expect(exposed.cancelDownload).toBeTypeOf('function');
  });
});
