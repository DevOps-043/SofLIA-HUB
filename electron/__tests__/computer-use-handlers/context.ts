import { beforeEach, vi } from 'vitest';
import { ipcMain, shell } from 'electron';
import { mockTrashItem } from '../computer-use-handlers.mocks';

export let executeToolDirect: (toolName: string, args: Record<string, any>, onProgress?: (msg: string) => void) => Promise<any>;
export let registerComputerUseHandlers: () => void;

beforeEach(async () => {
  vi.clearAllMocks();
  (ipcMain as any)._clearHandlers();
  Object.defineProperty(shell, 'trashItem', {
    value: mockTrashItem,
    configurable: true,
    writable: true,
  });
  mockTrashItem.mockResolvedValue(undefined);

  const mod = await import('../../computer-use-handlers');
  executeToolDirect = mod.executeToolDirect;
  registerComputerUseHandlers = mod.registerComputerUseHandlers;
});
