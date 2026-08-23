import { describe, expect, it, vi } from 'vitest';
import { registerMainProcessMessages } from '../../app/registerMainProcessMessages';
import { CHANNEL_GROUP_1 } from '../../../electron/preload/channel-group-1';

describe('registerMainProcessMessages', () => {
  it('mantiene el canal de arranque en la allowlist del preload', () => {
    expect(CHANNEL_GROUP_1).toContain('main-process-message');
  });

  it('permite montar el renderer cuando el preload no expone IPC', () => {
    expect(() => registerMainProcessMessages(undefined)).not.toThrow();
  });

  it('registra el canal cuando IPC esta disponible', () => {
    const on = vi.fn();

    registerMainProcessMessages({ on } as unknown as Pick<Window['ipcRenderer'], 'on'>);

    expect(on).toHaveBeenCalledWith('main-process-message', expect.any(Function));
  });

  it('no bloquea el arranque si el preload rechaza el canal', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const on = vi.fn(() => { throw new Error('Unauthorized IPC channel'); });

    expect(() => registerMainProcessMessages({ on } as unknown as Pick<Window['ipcRenderer'], 'on'>)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      '[BOOT] No se pudo registrar main-process-message:', expect.any(Error),
    );
    warn.mockRestore();
  });
});
