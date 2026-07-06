import { describe, expect, it, vi } from 'vitest';
import {
  createOcrLocatorProvider,
  createUiaLocatorProvider,
  describeLocateAttempts,
  ElementLocator,
  normalizeVisibleText,
  pickBestElement,
  scoreTextMatch,
  type ElementLocatorProvider,
  type LocatedElement,
} from '../desktop-agent/element-locator';
import type { WorkerElement, WorkerResponse } from '../desktop-agent/native-worker/worker-protocol';
import type { ScreenshotLayout } from '../desktop-agent/types';

function workerElement(name: string, x: number, y: number, w = 80, h = 30): WorkerElement {
  return { name, controlType: 'Button', rect: { x, y, width: w, height: h }, clickX: x + w / 2, clickY: y + h / 2 };
}

/** Worker falso que responde locateByText con una lista fija de elementos. */
function fakeWorker(elements: WorkerElement[], scanned = elements.length) {
  return {
    send: vi.fn(async (): Promise<WorkerResponse> => ({ id: 1, ok: true, cmd: 'locateByText', elements, scanned })),
  } as any;
}

function elemento(fuente: 'uia' | 'ocr', x = 100, y = 200): LocatedElement {
  return {
    texto: 'JUGAR',
    centroFisico: { x, y },
    centroImagen: { x, y },
    fuente,
    confianza: 1,
    textScore: 3,
    spatialScore: 1,
    rankingReason: 'test',
  };
}

function proveedorFake(
  fuente: 'uia' | 'ocr',
  resultado: LocatedElement | null,
  opciones: { disponible?: boolean; escaneados?: number; falla?: boolean } = {},
): ElementLocatorProvider {
  return {
    fuente,
    disponible: () => opciones.disponible ?? true,
    localizar: vi.fn(async () => {
      if (opciones.falla) throw new Error('proveedor caido');
      return { elemento: resultado, escaneados: opciones.escaneados ?? 10 };
    }),
  };
}

describe('Matching de texto visible', () => {
  it('EL-001: normaliza acentos, mayusculas y espacios', () => {
    expect(normalizeVisibleText('  ÚLTIMA   Versión ')).toBe('ultima version');
    expect(normalizeVisibleText('')).toBe('');
  });

  it('EL-002: puntua exacto > prefijo > contiene > nada', () => {
    expect(scoreTextMatch('JUGAR', 'jugar')).toBe(3);
    expect(scoreTextMatch('MINECRAFT: JAVA EDITION', 'minecraft')).toBe(2);
    expect(scoreTextMatch('Boton JUGAR ahora', 'jugar')).toBe(1);
    expect(scoreTextMatch('Instalaciones', 'jugar')).toBe(0);
  });

  it('EL-003: un fragmento trivial NO matchea un objetivo largo (evita clickear un simbolo)', () => {
    // Bug real detectado con UIA: "-" matcheaba "zzz-texto-inexistente".
    expect(scoreTextMatch('-', 'texto-inexistente-largo')).toBe(0);
    expect(scoreTextMatch('a', 'aceptar cambios')).toBe(0);
    // Pero un fragmento sustancial del objetivo si cuenta.
    expect(scoreTextMatch('reproducir', 'reproducir cancion')).toBe(2);
  });
});

describe('Orquestador ElementLocator', () => {
  it('EL-010: accesibilidad encuentra -> no consulta OCR', async () => {
    const uia = proveedorFake('uia', elemento('uia'));
    const ocr = proveedorFake('ocr', elemento('ocr'));
    const locator = new ElementLocator([uia, ocr]);

    const { elemento: encontrado, intentos } = await locator.localizarPorTexto('JUGAR');

    expect(encontrado?.fuente).toBe('uia');
    expect(ocr.localizar).not.toHaveBeenCalled();
    expect(intentos).toHaveLength(1);
  });

  it('EL-011: accesibilidad no encuentra -> OCR resuelve (via universal)', async () => {
    const uia = proveedorFake('uia', null, { escaneados: 4 });
    const ocr = proveedorFake('ocr', elemento('ocr', 555, 777));
    const locator = new ElementLocator([uia, ocr]);

    const { elemento: encontrado, intentos } = await locator.localizarPorTexto('JUGAR');

    expect(encontrado?.fuente).toBe('ocr');
    expect(encontrado?.centroFisico).toEqual({ x: 555, y: 777 });
    expect(intentos.map((intento) => intento.fuente)).toEqual(['uia', 'ocr']);
  });

  it('EL-012: proveedor no disponible (otra plataforma) se omite sin error', async () => {
    const uia = proveedorFake('uia', elemento('uia'), { disponible: false });
    const ocr = proveedorFake('ocr', elemento('ocr'));
    const locator = new ElementLocator([uia, ocr]);

    const { elemento: encontrado } = await locator.localizarPorTexto('JUGAR');

    expect(encontrado?.fuente).toBe('ocr');
    expect(uia.localizar).not.toHaveBeenCalled();
  });

  it('EL-013: proveedor que lanza error no rompe la cadena', async () => {
    const uia = proveedorFake('uia', null, { falla: true });
    const ocr = proveedorFake('ocr', elemento('ocr'));
    const locator = new ElementLocator([uia, ocr]);

    const { elemento: encontrado, intentos } = await locator.localizarPorTexto('JUGAR');

    expect(encontrado?.fuente).toBe('ocr');
    expect(intentos[0].error).toContain('proveedor caido');
  });

  it('EL-014: describeLocateAttempts produce diagnostico legible', () => {
    const texto = describeLocateAttempts([
      { fuente: 'uia', escaneados: 4, encontrado: false },
      { fuente: 'ocr', escaneados: 37, encontrado: false },
    ]);
    expect(texto).toContain('accesibilidad: 4 candidatos');
    expect(texto).toContain('lectura visual (OCR): 37 candidatos');
  });
});

describe('Proveedor OCR: bbox imagen -> fisico', () => {
  // Layout de un monitor 1920x1080 DIP renderizado a 1024x576 con offset (0, 96).
  const layout: ScreenshotLayout = {
    screenshotWidth: 1024,
    screenshotHeight: 768,
    offsetX: 0,
    offsetY: 96,
    renderScale: 0.5333,
    virtualBounds: { x: -1920, y: 0, width: 1920, height: 1080 },
    displayRegions: [{ displayId: '1', bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, left: 0, top: 96, width: 1024, height: 576 }],
  };

  function buildOcrProvider(overrides: Record<string, unknown> = {}) {
    return createOcrLocatorProvider({
      capturarPantalla: async () => ({ base64: 'img-base64', layout }),
      reconocerTextos: async () => ({
        lineas: [
          { texto: 'MINECRAFT: JAVA EDITION', confianza: 0.9, bbox: { x0: 240, y0: 340, x1: 400, y1: 360 } },
        ],
        palabras: [
          { texto: 'JUGAR', confianza: 0.95, bbox: { x0: 600, y0: 600, x1: 660, y1: 626 } },
          { texto: 'ruido', confianza: 0.1, bbox: { x0: 0, y0: 0, x1: 5, y1: 5 } },
        ],
      }),
      mapImagenADip: (x, y, capturaLayout) => {
        if (!capturaLayout) return null;
        return {
          x: capturaLayout.virtualBounds.x + (x - capturaLayout.offsetX) / capturaLayout.renderScale,
          y: capturaLayout.virtualBounds.y + (y - capturaLayout.offsetY) / capturaLayout.renderScale,
        };
      },
      dipAFisico: (punto) => punto, // monitor a 100%: DIP == fisico
      ...overrides,
    });
  }

  it('EL-020: localiza una palabra y convierte su centro a fisico', async () => {
    const provider = buildOcrProvider();
    const { elemento: encontrado } = await provider.localizar('JUGAR');

    // Centro imagen (630, 613) -> dip x = -1920 + 630/0.5333 ≈ -738.6 (round -739);
    // y = (613-96)/0.5333 ≈ 969.5 (round 969)
    expect(encontrado).not.toBeNull();
    expect(encontrado!.fuente).toBe('ocr');
    expect(encontrado!.centroFisico.x).toBe(-739);
    expect(encontrado!.centroFisico.y).toBe(969);
  });

  it('EL-021: objetivos multi-palabra se resuelven por linea', async () => {
    const provider = buildOcrProvider();
    const { elemento: encontrado } = await provider.localizar('minecraft java edition');
    expect(encontrado?.texto).toBe('MINECRAFT: JAVA EDITION');
  });

  it('EL-022: textos con confianza baja se descartan', async () => {
    const provider = buildOcrProvider();
    const { elemento: encontrado } = await provider.localizar('ruido');
    expect(encontrado).toBeNull();
  });

  it('EL-023: sin layout no arriesga un click mal mapeado', async () => {
    const provider = buildOcrProvider({ capturarPantalla: async () => ({ base64: 'x', layout: null }) });
    const { elemento: encontrado, escaneados } = await provider.localizar('JUGAR');
    expect(encontrado).toBeNull();
    expect(escaneados).toBe(0);
  });
});

describe('Proveedor UIA (worker)', () => {
  it('EL-030: pickBestElement elige el mejor candidato por texto', () => {
    const candidatos = [
      workerElement('MINECRAFT: JAVA EDITION', 10, 300, 200, 20),
      workerElement('JUGAR', 600, 600),
      workerElement('Instalaciones', 700, 40),
    ];
    expect(pickBestElement(candidatos, 'jugar')?.element.name).toBe('JUGAR');
    expect(pickBestElement(candidatos, 'minecraft')?.element.name).toBe('MINECRAFT: JAVA EDITION');
    expect(pickBestElement(candidatos, 'inexistente')).toBeNull();
  });

  it('EL-030b: desambiguacion espacial — el mismo texto en dos lugares, la pista elige', () => {
    // Caso real del log: "MINECRAFT" en el logo central y en la pestaña lateral.
    const logoCentral = workerElement('MINECRAFT', 900, 200, 400, 120); // centro ~ (1100, 260)
    const pestanaLateral = workerElement('MINECRAFT', 20, 300, 180, 24); // centro ~ (110, 312)
    const candidatos = [logoCentral, pestanaLateral];

    // Sin pista: gana el de menor area (la pestaña, más específica).
    expect(pickBestElement(candidatos, 'minecraft')?.element).toBe(pestanaLateral);
    // Pista cerca del logo central: gana el logo aunque sea más grande.
    expect(pickBestElement(candidatos, 'minecraft', { x: 1090, y: 255 })?.element).toBe(logoCentral);
    // Pista cerca de la pestaña: gana la pestaña.
    expect(pickBestElement(candidatos, 'minecraft', { x: 100, y: 310 })?.element).toBe(pestanaLateral);
  });

  it('EL-030c: con pista, un match parcial cercano vence a un exacto lejano', () => {
    const exactoLejano = workerElement('JUGAR', 100, 60, 90, 30);
    const parcialCercano = workerElement('JUGA', 590, 630, 160, 44);

    const best = pickBestElement([exactoLejano, parcialCercano], 'JUGAR', { x: 660, y: 650 });

    expect(best?.element).toBe(parcialCercano);
    expect(best?.textScore).toBe(2);
    expect(best?.spatialScore).toBeGreaterThan(0.9);
  });

  it('EL-030d: con pista, un unico match exacto lejano se rechaza', () => {
    const exactoLejano = workerElement('JUGAR', 100, 60, 90, 30);

    const best = pickBestElement([exactoLejano], 'JUGAR', { x: 660, y: 650 });

    expect(best).toBeNull();
  });

  it('EL-030e: un target bloqueado por verificacion no vuelve a ganar', () => {
    const fallido = workerElement('JUGAR', 590, 630, 160, 44);
    const alternativo = workerElement('JUGAR', 590, 500, 160, 44);

    const best = pickBestElement([fallido, alternativo], 'JUGAR', {
      pista: { x: 660, y: 520 },
      bloqueados: [{ texto: 'JUGAR', centroImagen: { x: 670, y: 652 } }],
    });

    expect(best?.element).toBe(alternativo);
  });

  it('EL-031: el provider pide locateByText al worker y devuelve el click fisico del match', async () => {
    const worker = fakeWorker([workerElement('JUGAR', 600, 600)], 230);
    const provider = createUiaLocatorProvider({ worker, sparseThreshold: 8, wakeDelayMs: 1200 });

    const { elemento: encontrado, escaneados } = await provider.localizar('jugar');

    expect(escaneados).toBe(230);
    expect(encontrado?.fuente).toBe('uia');
    expect(encontrado?.centroFisico).toEqual({ x: 640, y: 615 });
    // El despertar de accesibilidad y el escaneo viven en el worker: se le pasan los parametros.
    expect(worker.send).toHaveBeenCalledWith(expect.objectContaining({ cmd: 'locateByText', sparseThreshold: 8, wakeDelayMs: 1200 }));
  });

  it('EL-031b: sin coincidencia devuelve null con el conteo escaneado', async () => {
    const worker = fakeWorker([workerElement('Instalaciones', 700, 40)], 300);
    const provider = createUiaLocatorProvider({ worker });
    const { elemento: encontrado, escaneados } = await provider.localizar('jugar');
    expect(encontrado).toBeNull();
    expect(escaneados).toBe(300);
  });

  it('EL-032: solo esta disponible en Windows', () => {
    const provider = createUiaLocatorProvider({ worker: fakeWorker([]) });
    expect(provider.disponible()).toBe(process.platform === 'win32');
  });
});
