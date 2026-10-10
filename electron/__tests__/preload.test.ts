import { describe, it, expect, vi } from 'vitest';
import { exposeIntegratedBrowserApi } from '../preload/integrated-browser-api';
import type { IntegratedBrowserApi } from '../../src/services/integrated-browser-service';
import { registerPreloadChannelTests } from './preload/channel-cases';
import { registerPreloadPayloadTests } from './preload/payload-cases';
import { registerPreloadSourceTests } from './preload/source-cases';

describe('Preload IPC Security Layer', () => {
  it('transporta solo la opción de espera y conserva el payload previo al omitirla', async () => {
    let api!: IntegratedBrowserApi;
    const invoke = vi.fn(async () => ({ success: true }));
    exposeIntegratedBrowserApi({ exposeInMainWorld: (_name, value) => { api = value as IntegratedBrowserApi; } }, {
      safeInvoke: invoke, safeSend: vi.fn(), safeOn: vi.fn(() => vi.fn()), safeRemoveAllListeners: vi.fn(),
      sanitizePayload: value => value, validateChannel: vi.fn(),
    });
    await api.navigate('https://example.com/');
    expect(invoke).toHaveBeenLastCalledWith('integrated-browser:navigate', { target: 'https://example.com/' });
    await api.navigate('https://example.com/', { waitForLoad: false, target: 'no-se-transfiere' } as never);
    expect(invoke).toHaveBeenLastCalledWith('integrated-browser:navigate', { target: 'https://example.com/', waitForLoad: false });
    await api.open(undefined, { waitForLoad: false });
    expect(invoke).toHaveBeenLastCalledWith('integrated-browser:open', { waitForLoad: false });
    await api.createTab(undefined, { waitForLoad: false });
    expect(invoke).toHaveBeenLastCalledWith('integrated-browser:tab-create', { waitForLoad: false });
  });
  registerPreloadPayloadTests();
  registerPreloadChannelTests();
  registerPreloadSourceTests();
});
