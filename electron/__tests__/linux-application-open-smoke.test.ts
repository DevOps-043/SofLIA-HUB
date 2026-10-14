import { expect, it, vi } from 'vitest';

// Opt-in: el gate normal no abre aplicaciones en la máquina de desarrollo.
vi.mock('../background-process-service', () => ({ backgroundProcessService: {} }));

it.skipIf(process.env.PULSE_LINUX_FIREFOX_SMOKE !== '1')('abre Firefox instalado mediante el servicio Linux real', async () => {
  const { handleOpenPath } = await import('../computer-use/app-open-tool');
  const result = await handleOpenPath('open_application', { path: 'firefox' });
  console.info('Resultado de apertura Linux:', {
    success: result.success, resolvedPath: result.resolvedPath,
    window_verified: result.window_verified, error: result.error,
  });
  expect(result.success).toBe(true);
  expect(result.resolvedPath).toMatch(/firefox/);
  expect(typeof result.window_verified).toBe('boolean');
});
