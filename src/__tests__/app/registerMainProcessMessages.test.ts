import { describe, expect, it, vi } from 'vitest';
import { registerMainProcessMessages } from '../../app/registerMainProcessMessages';

describe('registerMainProcessMessages', () => {
  it('permite montar el renderer cuando el preload no expone IPC', () => {
    expect(() => registerMainProcessMessages(undefined)).not.toThrow();
  });

  it('registra el canal cuando IPC esta disponible', () => {
    const on = vi.fn();

    registerMainProcessMessages({ on } as unknown as Pick<Window['ipcRenderer'], 'on'>);

    expect(on).toHaveBeenCalledWith('main-process-message', expect.any(Function));
  });
});
