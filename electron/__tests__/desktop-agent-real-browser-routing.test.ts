import { describe, expect, it, vi } from 'vitest';
import { mapProgIdToBrowser } from '../browser-web/constants';
import {
  appendRealBrowserSessionGuidance,
  requiresRealBrowserSession,
  shouldUseBrowserBackend,
  shouldUseWindowsUIABackend,
} from '../desktop-agent/routing';
import { executeDesktopAgentTaskEntrypoint } from '../desktop-agent/task-entrypoint';

describe('Deteccion de navegador predeterminado (ProgId)', () => {
  it('RB-001: mapea los ProgId conocidos de Windows a cada navegador', () => {
    expect(mapProgIdToBrowser('ChromeHTML')).toBe('chrome');
    expect(mapProgIdToBrowser('MSEdgeHTM')).toBe('edge');
    expect(mapProgIdToBrowser('BraveHTML')).toBe('brave');
    expect(mapProgIdToBrowser('OperaStable')).toBe('opera');
    expect(mapProgIdToBrowser('VivaldiHTM.ABCDEF')).toBe('vivaldi');
    expect(mapProgIdToBrowser('FirefoxURL-308046B0AF4A39CB')).toBe('firefox');
    expect(mapProgIdToBrowser('')).toBe('desconocido');
    expect(mapProgIdToBrowser('AppXq0fevzme2pys62n3e0fbqa7peapykr8v')).toBe('desconocido');
  });
});

describe('Routing de sesion real del usuario', () => {
  it('RB-010: detecta tareas que dependen de la sesion o contraseñas del usuario', () => {
    expect(requiresRealBrowserSession('revisa el portal del banco donde ya estoy logueado')).toBe(true);
    expect(requiresRealBrowserSession('entra a mi cuenta de mercado libre y revisa mis compras')).toBe(true);
    expect(requiresRealBrowserSession('usa mis contraseñas guardadas para entrar al ERP')).toBe(true);
    expect(requiresRealBrowserSession('abre el sitio en mi navegador predeterminado')).toBe(true);
    expect(requiresRealBrowserSession('busca precios de laptops en amazon')).toBe(false);
  });

  it('RB-011: el flag useRealBrowser fuerza sesion real aunque no haya keywords', () => {
    expect(requiresRealBrowserSession('busca precios de laptops', { useRealBrowser: true })).toBe(true);
  });

  it('RB-012: backend browser explicito o perfil de Playwright ganan sobre las keywords', () => {
    expect(requiresRealBrowserSession('revisa mi cuenta del portal', { backend: 'browser' })).toBe(false);
    expect(requiresRealBrowserSession('revisa mi cuenta del portal', { browserProfile: 'ventas' })).toBe(false);
    expect(requiresRealBrowserSession('revisa mi cuenta del portal', { browserIsolated: true })).toBe(false);
  });

  it('RB-013: sin keyword routing solo aplica el flag explicito', () => {
    expect(requiresRealBrowserSession('revisa mi cuenta del portal', undefined, false)).toBe(false);
    expect(requiresRealBrowserSession('revisa mi cuenta del portal', { useRealBrowser: true }, false)).toBe(true);
  });

  it('RB-020: una tarea web con sesion real NO va al backend Playwright', () => {
    const task = 'entra a mi cuenta de gmail donde ya estoy logueado y revisa el ultimo correo';
    expect(shouldUseBrowserBackend(task)).toBe(false);
    expect(shouldUseWindowsUIABackend(task)).toBe(false);
  });

  it('RB-021: useRealBrowser gana incluso sobre backend browser explicito', () => {
    expect(shouldUseBrowserBackend('abre gmail', { backend: 'browser', useRealBrowser: true })).toBe(false);
  });

  it('RB-022: una tarea con sesion real que menciona apps UIA tampoco va a windows_uia', () => {
    expect(shouldUseWindowsUIABackend('revisa outlook web donde ya estoy logueado')).toBe(false);
  });

  it('RB-030: la guia de navegador real instruye open_url y prohibe Playwright', () => {
    const guided = appendRealBrowserSessionGuidance('revisa mi cuenta del banco');
    expect(guided).toContain('revisa mi cuenta del banco');
    expect(guided).toContain('[NAVEGADOR REAL]');
    expect(guided).toContain('open_url');
  });
});

describe('Entrypoint con sesion real', () => {
  it('RB-040: ejecuta por backend visual con la guia inyectada y emite el evento', async () => {
    const browserWeb = { executeTask: vi.fn(async () => 'no debe ejecutarse') };
    const windowsUIA = { executeTask: vi.fn(async () => 'no debe ejecutarse'), getLastRunResult: vi.fn(() => null) };
    const executeTaskInternal = vi.fn(async (task: string) => ({
      taskId: 't1', estado: 'completada' as const, mensaje: `ok: ${task}`, pasosEjecutados: 1, duracionMs: 10,
    }));
    const emit = vi.fn();

    const outcome = await executeDesktopAgentTaskEntrypoint(
      'entra a mi cuenta del portal de facturacion donde ya estoy logueado',
      undefined,
      {
        apiKey: 'test-key',
        browserWeb: browserWeb as any,
        windowsUIA: windowsUIA as any,
        config: { keywordRoutingEnabled: true, maxConcurrentAgents: 1, queueTimeoutMs: 1000 } as any,
        activeTasks: new Map(),
        taskQueue: [],
        emit,
        executeTaskInternal: executeTaskInternal as any,
        runDesktopFallbackFromUIA: vi.fn(),
      },
    );

    expect(browserWeb.executeTask).not.toHaveBeenCalled();
    expect(windowsUIA.executeTask).not.toHaveBeenCalled();
    expect(executeTaskInternal).toHaveBeenCalledTimes(1);
    const taskEjecutada = executeTaskInternal.mock.calls[0][0];
    expect(taskEjecutada).toContain('[NAVEGADOR REAL]');
    expect(emit).toHaveBeenCalledWith('task-real-browser-session', expect.objectContaining({ task: expect.any(String) }));
    expect(outcome.estado).toBe('completada');
  });
});
