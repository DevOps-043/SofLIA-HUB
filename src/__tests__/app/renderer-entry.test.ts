import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ render: vi.fn(), mainLoaded: vi.fn(), orbLoaded: vi.fn(), register: vi.fn() }));
vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render: mocks.render }) } }));
vi.mock('../../App.tsx', () => { mocks.mainLoaded(); return { default: () => null }; });
vi.mock('../../app/OrbApp', () => { mocks.orbLoaded(); return { default: () => null }; });
vi.mock('../../app/registerMainProcessMessages', () => ({ registerMainProcessMessages: mocks.register }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
afterEach(() => window.history.replaceState({}, '', '/'));

describe('Entrada de renderer por superficie', () => {
  it('la ventana flotante carga su root sin importar el shell principal', async () => {
    window.history.replaceState({}, '', '/?view=orb');
    await import('../../main'); await vi.dynamicImportSettled();
    expect(mocks.orbLoaded).toHaveBeenCalledOnce();
    expect(mocks.mainLoaded).not.toHaveBeenCalled();
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.register).toHaveBeenCalledOnce();
  });
  it('la ventana principal conserva su shell sin cargar el root flotante', async () => {
    window.history.replaceState({}, '', '/');
    await import('../../main'); await vi.dynamicImportSettled();
    expect(mocks.mainLoaded).toHaveBeenCalledOnce();
    expect(mocks.orbLoaded).not.toHaveBeenCalled();
    expect(mocks.render).toHaveBeenCalledOnce();
  });
});
