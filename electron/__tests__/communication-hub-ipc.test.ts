import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { registerCommunicationHubHandlers } from '../communication-hub-handlers';
import type { CommunicationHubService } from '../communication-hub/service';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { setOrganizationContext } from '../main/organization-context';

const harness = ipcMain as unknown as { _clearHandlers(): void; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
let hub: ReturnType<typeof authSourceFixture>;
const capabilities = vi.fn(async () => ({ success: true }));
beforeEach(() => {
  harness._clearHandlers(); vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario' }); setOrganizationContext('usuario', 'org'); hub = authSourceFixture();
  Reflect.apply(registerCommunicationHubHandlers, undefined, [{ getCapabilities: capabilities } as unknown as CommunicationHubService, () => [hub.window]]);
});
describe('Autoridad de Communication Hub IPC', () => {
  it('rechaza actor falso sin invocar servicio', async () => {
    const reply = await harness._getHandler('channels:get-capabilities')(hub.event, { userId: 'otra-persona' });
    expect(reply).toMatchObject({ success: false }); expect(capabilities).not.toHaveBeenCalled();
  });
  it('rechaza fuente ajena sin invocar servicio', async () => {
    const reply = await harness._getHandler('channels:get-capabilities')(authSourceFixture().event);
    expect(reply).toMatchObject({ success: false }); expect(capabilities).not.toHaveBeenCalled();
  });
});
