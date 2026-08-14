import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeIntegratedBrowserTool } from '../../services/gemini-chat/integrated-browser-tools';

/**
 * Las dos herramientas de vision del navegador. Lo que se protege aqui es una
 * sola regla: SofLIA no describe lo que no pudo observar. Cada degradacion
 * —DRM, muestreo, posicion desconocida— tiene que llegar al modelo declarada.
 */

function instalarNavegador(overrides: Record<string, any> = {}): Record<string, any> {
  const api: Record<string, any> = {
    getState: vi.fn(async () => ({ success: true, state: { isVisible: true, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })),
    captureFrame: vi.fn(async () => ({
      success: true,
      capture: { ok: true, screenshot: 'data:image/jpeg;base64,Y2FwdHVyYQ==', capturedAt: '2026-08-13T10:00:00.000Z', url: 'https://ejemplo.test/' },
    })),
    getPlayerState: vi.fn(async () => ({
      success: true,
      player: { hasVideo: true, currentTimeSeconds: 120, durationSeconds: 600, paused: false, publicVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })),
    sampleFrames: vi.fn(async () => ({
      success: true,
      frames: [
        { screenshot: 'data:image/jpeg;base64,AAA', atSeconds: 10 },
        { screenshot: 'data:image/jpeg;base64,BBB', atSeconds: 12 },
      ],
      failure: null,
    })),
    ...overrides,
  };
  Object.defineProperty(window, 'integratedBrowser', { configurable: true, value: api });
  return api;
}

describe('capturar_vista_navegador', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('VIS-001: entrega un cuadro fresco con su marca de tiempo', async () => {
    const api = instalarNavegador();

    const salida = JSON.parse(await executeIntegratedBrowserTool('capturar_vista_navegador', { motivo: 'ver la escena' }));

    expect(api.captureFrame).toHaveBeenCalledTimes(1);
    expect(salida.success).toBe(true);
    expect(salida.captura).toBe('data:image/jpeg;base64,Y2FwdHVyYQ==');
    expect(salida.capturada_en).toBe('2026-08-13T10:00:00.000Z');
  });

  it('VIS-002: no reutiliza la observacion pasiva', async () => {
    const getObservation = vi.fn();
    const api = instalarNavegador({ getObservation });

    await executeIntegratedBrowserTool('capturar_vista_navegador', {});

    expect(api.captureFrame).toHaveBeenCalled();
    expect(getObservation).not.toHaveBeenCalled();
  });

  it('VIS-003: contenido protegido se declara y prohibe describir la escena', async () => {
    instalarNavegador({
      captureFrame: vi.fn(async () => ({
        success: true,
        capture: { ok: false, reason: 'contenido-protegido', detail: 'La captura no tiene contenido discernible.' },
      })),
    });

    const salida = JSON.parse(await executeIntegratedBrowserTool('capturar_vista_navegador', {}));

    expect(salida.success).toBe(false);
    expect(salida.evidencia).toBe('no-disponible');
    expect(salida.motivo).toBe('contenido-protegido');
    expect(salida.instruccion).toContain('No describas la escena');
    expect(salida.captura).toBeUndefined();
  });

  it('VIS-004: sin pestaña visible no se captura nada', async () => {
    const api = instalarNavegador({
      getState: vi.fn(async () => ({ success: true, state: { isVisible: false } })),
    });

    const salida = JSON.parse(await executeIntegratedBrowserTool('capturar_vista_navegador', {}));

    expect(salida.success).toBe(false);
    expect(api.captureFrame).not.toHaveBeenCalled();
  });

  it('VIS-005: la peticion de detalle se traslada al resultado', async () => {
    instalarNavegador();

    const salida = JSON.parse(await executeIntegratedBrowserTool('capturar_vista_navegador', { detalle: true }));

    expect(salida.resolucion).toBe('alta');
  });
});

describe('analizar_video_pestana', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('VID-001: un video publico viaja por URI acotado a la posicion actual', async () => {
    const api = instalarNavegador();

    const salida = JSON.parse(await executeIntegratedBrowserTool('analizar_video_pestana', { pregunta: 'que se ve' }));

    expect(salida.evidencia).toBe('video');
    expect(salida.fuente).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(salida.__media[0].kind).toBe('public-video');
    // Ventana centrada en el segundo 120: arranca 30 s antes.
    expect(salida.__media[0].window.startSeconds).toBe(90);
    expect(salida.posicion_alineada).toBe(true);
    expect(api.sampleFrames).not.toHaveBeenCalled();
  });

  it('VID-002: un reproductor no direccionable degrada a muestreo declarado', async () => {
    const api = instalarNavegador({
      getPlayerState: vi.fn(async () => ({
        success: true,
        player: { hasVideo: true, currentTimeSeconds: 30, durationSeconds: 300, paused: false, publicVideoUrl: null },
      })),
    });

    const salida = JSON.parse(await executeIntegratedBrowserTool('analizar_video_pestana', { pregunta: 'que se ve' }));

    expect(api.sampleFrames).toHaveBeenCalled();
    expect(salida.evidencia).toBe('muestreo-de-cuadros');
    expect(salida.nota).toContain('MUESTREO');
    expect(salida.marcas_de_tiempo).toEqual([10, 12]);
    expect(salida.__media[0].kind).toBe('frames');
    expect(salida.__media[0].frames[0].base64).toBe('AAA');
  });

  it('VID-003: una posicion desconocida arranca del inicio y lo declara', async () => {
    instalarNavegador({
      getPlayerState: vi.fn(async () => ({
        success: true,
        player: { hasVideo: true, currentTimeSeconds: null, durationSeconds: 600, paused: false, publicVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      })),
    });

    const salida = JSON.parse(await executeIntegratedBrowserTool('analizar_video_pestana', {}));

    expect(salida.__media[0].window.startSeconds).toBe(0);
    expect(salida.posicion_alineada).toBe(false);
    expect(salida.nota).toContain('No pude leer la posicion de reproduccion');
  });

  it('VID-004: sin video en la pestaña se falla sin inventar evidencia', async () => {
    instalarNavegador({
      getPlayerState: vi.fn(async () => ({
        success: true,
        player: { hasVideo: false, currentTimeSeconds: null, durationSeconds: null, paused: true, publicVideoUrl: null },
      })),
    });

    const salida = JSON.parse(await executeIntegratedBrowserTool('analizar_video_pestana', {}));

    expect(salida.success).toBe(false);
    expect(salida.__media).toBeUndefined();
  });

  it('VID-005: un muestreo sin cuadros declara la falta de evidencia', async () => {
    instalarNavegador({
      getPlayerState: vi.fn(async () => ({
        success: true,
        player: { hasVideo: true, currentTimeSeconds: 5, durationSeconds: 60, paused: false, publicVideoUrl: null },
      })),
      sampleFrames: vi.fn(async () => ({
        success: true,
        frames: [],
        failure: { ok: false, reason: 'contenido-protegido', detail: 'Reproduccion protegida.' },
      })),
    });

    const salida = JSON.parse(await executeIntegratedBrowserTool('analizar_video_pestana', {}));

    expect(salida.success).toBe(false);
    expect(salida.motivo).toBe('contenido-protegido');
    expect(salida.instruccion).toContain('No describas la escena');
  });

  it('VID-006: la ventana nunca supera el maximo por turno aunque se pida mas', async () => {
    instalarNavegador();

    const salida = JSON.parse(await executeIntegratedBrowserTool('analizar_video_pestana', { ventana_segundos: 5_000 }));
    const { startSeconds, endSeconds } = salida.__media[0].window;

    expect(endSeconds - startSeconds).toBeLessThanOrEqual(90);
  });

  it('VID-007: analizar el video no interactua con la pagina', async () => {
    const api = instalarNavegador({
      navigate: vi.fn(),
      clickElement: vi.fn(),
      typeInElement: vi.fn(),
      scroll: vi.fn(),
    });

    await executeIntegratedBrowserTool('analizar_video_pestana', {});

    expect(api.navigate).not.toHaveBeenCalled();
    expect(api.clickElement).not.toHaveBeenCalled();
    expect(api.typeInElement).not.toHaveBeenCalled();
    expect(api.scroll).not.toHaveBeenCalled();
  });
});
