import { describe, expect, it, vi } from 'vitest';
import { executeDesktopAction } from '../desktop-agent/action-executor';
import type { DesktopActionExecutionContext } from '../desktop-agent/action-executor-context';
import { isKnownDesktopAction } from '../desktop-agent/action-types';
import { parseDesktopActionResponse } from '../desktop-agent/parsers';
import { VISION_PROMPT_RESPONSE_CONTRACT } from '../desktop-agent/vision-prompt-rules';
import { assertActionTargetsVisibleContent } from '../desktop-agent/action-coordinate-resolution';
import { isDeterministicActionError } from '../desktop-agent/action-errors';
import { DEFAULT_CONFIG } from '../desktop-agent-types';

function buildContext(overrides: Partial<DesktopActionExecutionContext> = {}): DesktopActionExecutionContext {
  return {
    config: { ...DEFAULT_CONFIG },
    getUIElements: () => [],
    setLastZoomImage: vi.fn(),
    refineActionCoordinates: (action) => action,
    logActionCoordinateResolution: vi.fn(),
    assertActionTargetsVisibleContent: vi.fn(),
    mouseClick: vi.fn(async () => {}),
    mouseDoubleClick: vi.fn(async () => {}),
    mouseRightClick: vi.fn(async () => {}),
    mouseDrag: vi.fn(async () => {}),
    mouseDown: vi.fn(async () => {}),
    mouseUp: vi.fn(async () => {}),
    mouseMove: vi.fn(async () => {}),
    mouseScroll: vi.fn(async () => {}),
    keyboardType: vi.fn(async () => {}),
    keyboardKey: vi.fn(async () => {}),
    focusWindow: vi.fn(async () => true),
    minimizeWindow: vi.fn(async () => true),
    maximizeWindow: vi.fn(async () => true),
    restoreWindow: vi.fn(async () => true),
    closeWindow: vi.fn(async () => true),
    waitForScreenChange: vi.fn(async () => true),
    waitForWindow: vi.fn(async () => true),
    openApplication: vi.fn(async () => ({ success: true, message: 'Aplicacion abierta', windowTitle: 'Spotify' })),
    openUrl: vi.fn(async () => ({ success: true, message: 'URL abierta' })),
    clickElementByName: vi.fn(async () => ({ found: true, fuente: 'uia' as const, texto: 'ok', x: 1, y: 1, intentos: [] })),
    takeZoomScreenshot: vi.fn(async () => 'zoom-base64'),
    mapDesktopPointToScreenshotPoint: () => null,
    delay: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('Clic en padding = fallo determinista (no reintentar)', () => {
  const enPadding = (_x: number, _y: number) => ({ x: 0, y: 0, source: 'layout' as const, regionLabel: 'padding' });
  const enContenido = (x: number, y: number) => ({ x, y, source: 'layout' as const, regionLabel: 'monitor 1' });

  it('DA-PAD-1: un click en padding lanza DeterministicActionError (evita 3 reintentos inutiles)', () => {
    let capturado: unknown;
    try {
      assertActionTargetsVisibleContent({ action: 'click', x: 700, y: 740, message: 'x' }, enPadding);
    } catch (error) {
      capturado = error;
    }
    expect(capturado).toBeInstanceOf(Error);
    expect(isDeterministicActionError(capturado)).toBe(true);
    expect((capturado as Error).message).toContain('padding');
  });

  it('DA-PAD-2: un click sobre contenido visible no lanza', () => {
    expect(() => assertActionTargetsVisibleContent({ action: 'click', x: 500, y: 400, message: 'x' }, enContenido)).not.toThrow();
  });
});

describe('Acciones deterministas del Desktop Agent', () => {
  it('DA-001: open_application despacha al callback con el appName', async () => {
    const context = buildContext();
    await executeDesktopAction({ action: 'open_application', appName: 'Spotify', message: 'Abrir Spotify' }, context);
    expect(context.openApplication).toHaveBeenCalledWith('Spotify');
  });

  it('DA-002: open_url despacha al callback y espera cambio de pantalla', async () => {
    const context = buildContext();
    await executeDesktopAction({ action: 'open_url', url: 'https://music.youtube.com', message: 'Abrir YT Music' }, context);
    expect(context.openUrl).toHaveBeenCalledWith('https://music.youtube.com');
    expect(context.waitForScreenChange).toHaveBeenCalled();
  });

  it('DA-003: open_application sin appName falla con error explicito', async () => {
    const context = buildContext();
    await expect(executeDesktopAction({ action: 'open_application', message: 'sin app' }, context))
      .rejects.toThrow(/appName/);
    expect(context.openApplication).not.toHaveBeenCalled();
  });

  it('DA-004: open_url sin url falla con error explicito', async () => {
    const context = buildContext();
    await expect(executeDesktopAction({ action: 'open_url', message: 'sin url' }, context))
      .rejects.toThrow(/url/);
  });

  it('DA-005: el error del lanzador se propaga para quedar en el historial', async () => {
    const context = buildContext({
      openApplication: vi.fn(async () => { throw new Error('No pude localizar una aplicacion instalada que coincida con "Foo".'); }),
    });
    await expect(executeDesktopAction({ action: 'open_application', appName: 'Foo', message: 'abrir foo' }, context))
      .rejects.toThrow(/No pude localizar/);
  });

  it('DA-006: el union de acciones reconoce las nuevas acciones deterministas', () => {
    expect(isKnownDesktopAction('open_application')).toBe(true);
    expect(isKnownDesktopAction('open_url')).toBe(true);
    expect(isKnownDesktopAction('invented_action')).toBe(false);
  });

  it('DA-007: parseDesktopActionResponse rechaza acciones desconocidas del LLM', () => {
    expect(() => parseDesktopActionResponse('{"action":"self_destruct","message":"x"}'))
      .toThrow(/accion desconocida/);
    const parsed = parseDesktopActionResponse('{"action":"open_url","url":"https://a.b","message":"ok"}');
    expect(parsed.action).toBe('open_url');
  });

  it('DA-008: el contrato del prompt incluye click_element_by_name', () => {
    expect(VISION_PROMPT_RESPONSE_CONTRACT).toContain('click_element_by_name');
  });

  it('DA-009: click_element usa el centro del elementId marcado', async () => {
    const setResolvedTarget = vi.fn();
    const mouseClick = vi.fn(async () => {});
    const context = buildContext({
      getUIElements: () => [{
        id: 7,
        name: 'JUGAR',
        controlType: 'Button',
        boundingRect: { x: 100, y: 200, width: 80, height: 40 },
        isEnabled: true,
        value: '',
      }],
      mapDesktopPointToScreenshotPoint: (x, y) => ({ x: x / 2, y: y / 2 }),
      mouseClick,
      setResolvedTarget,
    });

    await executeDesktopAction({ action: 'click_element', elementId: 7, message: 'click marca' }, context);

    expect(mouseClick).toHaveBeenCalledWith(70, 110);
    expect(setResolvedTarget).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'element',
      text: 'JUGAR',
      centroImagen: { x: 70, y: 110 },
    }));
  });
});
