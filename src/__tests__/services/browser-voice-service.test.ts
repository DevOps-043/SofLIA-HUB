import { afterEach, expect, it, vi } from 'vitest';
import { orbService } from '../../services/orb-service';

afterEach(() => { delete window.orb; });
it('la voz delega la acción literal y conserva errores del puente', async () => {
  const browserCommand = vi.fn().mockResolvedValue({ success: false, error: 'Tarea cambiada.' });
  window.orb = { browserCommand } as unknown as NonNullable<Window['orb']>;
  expect(await orbService.browserCommand('pause')).toEqual({ success: false, error: 'Tarea cambiada.' });
  expect(browserCommand).toHaveBeenCalledWith('pause');
});
it('no simula éxito fuera de Electron', () => {
  delete window.orb;
  expect(() => orbService.browserCommand('task-status')).toThrow('no está disponible');
});
