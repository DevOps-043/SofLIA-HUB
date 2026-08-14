import { afterEach, describe, expect, it, vi } from 'vitest';
import { preparePresentationSourceVisuals } from '../../services/gemini-chat/presentation-source-visuals';
import { PRESENTACIONES_SKILL_ID } from '../../shared/skills/presentaciones-skill';

type TestScope = Window & { skillWorkspace?: unknown };

const activeSkill = {
  id: PRESENTACIONES_SKILL_ID,
  workspaceId: 'deck-source-visuals',
};

afterEach(() => {
  delete (window as TestScope).skillWorkspace;
  vi.restoreAllMocks();
});

describe('visuales de fuente para presentaciones', () => {
  it('no toca el workspace fuera de la Skill de presentaciones', async () => {
    const writeImage = vi.fn();
    (window as TestScope).skillWorkspace = { writeImage, downloadImage: vi.fn() };

    const result = await preparePresentationSourceVisuals({
      activeSkill: { id: 'sistema:otra', workspaceId: 'otro' },
      inlineImages: ['data:image/png;base64,YWJj'],
    });

    expect(result.visuals).toEqual([]);
    expect(writeImage).not.toHaveBeenCalled();
  });

  it('guarda adjuntos y descarga primero las imagenes web pertinentes', async () => {
    const writeImage = vi.fn(async (_workspaceId: string, fileName: string) => ({
      success: true,
      file: { path: `assets/${fileName}` },
    }));
    const downloadImage = vi.fn(async (_workspaceId: string, _url: string, fileName: string) => ({
      success: true,
      file: { path: `assets/${fileName}.png` },
    }));
    (window as TestScope).skillWorkspace = { writeImage, downloadImage };

    const result = await preparePresentationSourceVisuals({
      activeSkill,
      inlineImages: [
        'data:image/png;base64,YWJj',
        'data:image/png;base64,YWJj',
        'data:image/jpeg;base64,ZGVm',
      ],
      browserImages: [
        { url: 'https://example.com/sin-alt.png?firma=no-exponer', alt: '', width: 1800, height: 1200 },
        { url: 'https://example.com/grafica.png', alt: 'Grafica trimestral', width: 900, height: 600 },
        { url: 'https://example.com/foto.png', alt: 'Equipo en laboratorio', width: 1200, height: 800 },
      ],
      browserSource: { title: 'Reporte anual', url: 'https://example.com/reporte?token=secreto' },
    });

    expect(writeImage).toHaveBeenCalledTimes(2);
    expect(writeImage).toHaveBeenNthCalledWith(
      1,
      'deck-source-visuals',
      expect.stringMatching(/^fuente-adjunta-[a-f0-9]{8}\.png$/),
      'YWJj',
    );
    expect(writeImage).toHaveBeenNthCalledWith(
      2,
      'deck-source-visuals',
      expect.stringMatching(/^fuente-adjunta-[a-f0-9]{8}\.jpg$/),
      'ZGVm',
    );
    expect(downloadImage.mock.calls.map((call) => call[1])).toEqual([
      'https://example.com/foto.png',
      'https://example.com/grafica.png',
      'https://example.com/sin-alt.png?firma=no-exponer',
    ]);
    expect(result.visuals).toHaveLength(5);
    expect(result.context).toContain('INICIO_MANIFIESTO_VISUALES_FUENTE_NO_CONFIABLE');
    expect(result.context).toMatch(/assets\/fuente-web-[a-f0-9]{8}\.png/);
    expect(result.context).toContain('genera imagenes nuevas solo para conceptos sin visual de fuente');
    expect(result.context).toContain('"origin":"https://example.com"');
    expect(result.context).not.toContain('token=secreto');
    expect(result.context).not.toContain('firma=no-exponer');
  });

  it('degrada por recurso y conserva los visuales que si pudo importar', async () => {
    (window as TestScope).skillWorkspace = {
      writeImage: vi.fn(async () => { throw new Error('imagen invalida'); }),
      downloadImage: vi.fn(async () => ({
        success: true,
        file: { path: 'assets/fuente-web-01.webp' },
      })),
    };

    const result = await preparePresentationSourceVisuals({
      activeSkill,
      inlineImages: ['data:image/png;base64,YWJj'],
      browserImages: [
        { url: 'https://example.com/visual.webp', alt: 'Visual de fuente', width: 1000, height: 700 },
      ],
    });

    expect(result.visuals).toEqual([
      expect.objectContaining({ path: 'assets/fuente-web-01.webp', origin: 'pagina_web' }),
    ]);
    expect(result.failed).toBe(1);
  });

  it('registra el fallo aunque ningun recurso pueda materializarse', async () => {
    (window as TestScope).skillWorkspace = {
      writeImage: vi.fn(async () => ({ success: false, error: 'sin espacio' })),
      downloadImage: vi.fn(async () => ({ success: false, error: 'bloqueada' })),
    };

    const result = await preparePresentationSourceVisuals({
      activeSkill,
      inlineImages: ['data:image/png;base64,YWJj'],
      browserImages: [
        { url: 'https://example.com/bloqueada.png', alt: 'Grafica', width: 900, height: 600 },
      ],
    });

    expect(result.visuals).toEqual([]);
    expect(result.failed).toBe(2);
    expect(result.context).toContain('"visuals":[]');
    expect(result.context).toContain('"failed":2');
  });
});
