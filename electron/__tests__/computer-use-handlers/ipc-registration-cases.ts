import { describe, it, expect } from 'vitest';
import { ipcMain } from 'electron';
import { registerComputerUseHandlers } from './context';

describe('Computer-use IPC registration', () => {
  it('CU-100: registerComputerUseHandlers registers all IPC channels', () => {
    registerComputerUseHandlers();
    const registeredChannels = Array.from((ipcMain as any)._getHandlers().keys());
    const expectedChannels = [
      'computer:list-screens',
      'computer:list-processes',
      'computer:kill-process',
      'computer:list-directory',
      'computer:read-file',
      'computer:write-file',
      'computer:create-directory',
      'computer:move-item',
      'computer:copy-item',
      'computer:delete-item',
      'computer:get-file-info',
      'computer:search-files',
      'computer:organize-files',
      'computer:batch-move-files',
      'computer:list-directory-summary',
      'computer:undo-last-file-operation',
      'computer:execute-command',
      'computer:open-application',
      'computer:open-file-on-computer',
      'computer:open-url',
      'computer:run-background-command',
      'computer:list-process-sessions',
      'computer:poll-process-session',
      'computer:kill-process-session',
      'computer:get-system-info',
      'computer:clipboard-read',
      'computer:clipboard-write',
      'computer:use-computer',
      'computer:take-screenshot',
      'computer:confirm-action',
      'computer:get-email-config',
      'computer:configure-email',
      'computer:send-email',
    ];

    for (const channel of expectedChannels) {
      expect(registeredChannels).toContain(channel);
    }
  });
});
