import { afterEach, describe, expect, it, vi } from 'vitest';
import { installUpdate } from '../../services/updater-service';

afterEach(() => { Reflect.deleteProperty(window, 'updater'); });

describe('instalación de actualización en renderer', () => {
  it('rechaza un bridge ausente sin aparentar instalación', async () => {
    await expect(installUpdate()).rejects.toThrow(/escritorio/);
  });

  it('propaga cancelación o error de main', async () => {
    Object.defineProperty(window, 'updater', { configurable: true, value: { installUpdate: vi.fn(async () => ({ success: false, error: 'Salida cancelada' })) } });
    await expect(installUpdate()).rejects.toThrow('Salida cancelada');
  });

  it('espera la respuesta exitosa sin adelantar el resultado', async () => {
    let finish!: (value: { success: boolean }) => void;
    Object.defineProperty(window, 'updater', { configurable: true, value: { installUpdate: vi.fn(() => new Promise((resolve) => { finish = resolve; })) } });
    let done = false;
    const pending = installUpdate().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    finish({ success: true });
    await pending;
    expect(done).toBe(true);
  });
});
