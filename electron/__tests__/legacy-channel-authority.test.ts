import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { registerMainServiceIpcHandlers } from '../main/service-ipc';
import { registerTelegramHandlers } from '../telegram-handlers';
import { authSourceFixture } from './helpers/auth-source.fixture';
import type { MainRuntimeState } from '../main/runtime-state';
import type { TelegramService } from '../telegram-service';
vi.mock('../learning-live-handlers', () => ({ registerLearningLiveHandlers: vi.fn() }));
const harness = ipcMain as unknown as { _clearHandlers(): void; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> };
const status = vi.fn(() => ({ connected: true })), save = vi.fn(async () => {}), init = vi.fn();
beforeEach(() => { harness._clearHandlers(); vi.clearAllMocks(); const hub = authSourceFixture(); registerMainServiceIpcHandlers({ services: { waService: { getStatus: status, saveApiKey: save, on: vi.fn() } }, state: { win: hub.window, orbWin: null } as unknown as MainRuntimeState, initWhatsAppAgent: init }); });
describe('Vías de comunicación heredadas', () => {
  it('registro activo WhatsApp rechaza fuente ajena', async () => { expect(await harness._getHandler('whatsapp:get-status')(authSourceFixture().event)).toMatchObject({ success: false }); expect(status).not.toHaveBeenCalled(); });
  it('Telegram rechaza fuente ajena', async () => { Reflect.apply(registerTelegramHandlers, undefined, [{ getStatus: status } as unknown as TelegramService]); expect(await harness._getHandler('telegram:get-status')(authSourceFixture().event)).toMatchObject({ success: false }); expect(status).not.toHaveBeenCalled(); });
});
