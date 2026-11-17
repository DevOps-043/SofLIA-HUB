import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ environment: vi.fn(), modules: vi.fn(), construct: vi.fn() }));
vi.mock('../main/environment', () => ({ configureMainProcessEnvironment: mocks.environment }));
vi.mock('../main/service-modules', () => ({ loadMainServiceModules: mocks.modules }));
vi.mock('../main/service-factory', () => ({ createMainServices: mocks.construct }));

describe('Entorno antes de cargar servicios', () => {
  it('configura variables antes del import y no construye servicios si éste falla', async () => {
    const failure = new Error('Fallo de carga simulado');
    let configured = false;
    mocks.environment.mockImplementation(() => {
      configured = true;
      return { VITE_DEV_SERVER_URL: undefined, RENDERER_DIST: '/fixture/dist' };
    });
    mocks.modules.mockImplementation(async () => {
      expect(configured).toBe(true);
      throw failure;
    });
    const { runBootstrap } = await import('../main/bootstrap');
    await expect(runBootstrap()).rejects.toBe(failure);
    expect(mocks.environment).toHaveBeenCalledOnce();
    expect(mocks.construct).not.toHaveBeenCalled();
  });
});
