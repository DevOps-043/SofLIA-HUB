import { beforeEach, describe, expect, it, vi } from 'vitest';

const createElectronSupabaseClientMock = vi.hoisted(() =>
  vi.fn(() => ({ auth: {} })),
);

vi.mock('../../lib/supabase-factory', () => ({
  createElectronSupabaseClient: createElectronSupabaseClientMock,
  isValidUrl: (url: string) => /^https:\/\/[^/]+/i.test(url),
}));

describe('supabase runtime config bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    createElectronSupabaseClientMock.mockClear();
    Reflect.deleteProperty(window as typeof window & { appRuntime?: unknown }, 'appRuntime');
  });

  it('prefiere la configuracion runtime de Lia cuando el renderer trae valores viejos', async () => {
    vi.doMock('../../config', () => ({
      SUPABASE: {
        URL: 'https://renderer-stale.supabase.co',
        ANON_KEY: 'not-a-real-key',
      },
    }));

    Object.defineProperty(window, 'appRuntime', {
      configurable: true,
      writable: true,
      value: {
        liaSupabase: {
          url: 'https://lia-runtime.supabase.co',
          anonKey: 'eyJ.runtime.payload',
          keyKind: 'jwt',
          projectRef: 'lia-runtime',
        },
      },
    });

    const module = await import('../../lib/supabase');

    expect(createElectronSupabaseClientMock).toHaveBeenCalledWith(
      'https://lia-runtime.supabase.co',
      'eyJ.runtime.payload',
    );
    expect(module.getSupabaseConfigDiagnostics().effective.source).toBe('runtime_env');
    expect(module.isSupabaseConfigured()).toBe(true);
  });

  it('usa la configuracion del renderer cuando no hay bridge runtime disponible', async () => {
    vi.doMock('../../config', () => ({
      SUPABASE: {
        URL: 'https://renderer-live.supabase.co',
        ANON_KEY: 'eyJ.renderer.payload',
      },
    }));

    const module = await import('../../lib/supabase');

    expect(createElectronSupabaseClientMock).toHaveBeenCalledWith(
      'https://renderer-live.supabase.co',
      'eyJ.renderer.payload',
    );
    expect(module.getSupabaseConfigDiagnostics().effective.source).toBe('renderer_env');
    expect(module.getSupabaseConfigDiagnostics().usingRuntimeOverride).toBe(false);
  });
});
