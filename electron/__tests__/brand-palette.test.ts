import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  ensureContrast,
  extractPaletteFromBgra,
  parseHex,
  shade,
  toHex,
} from '../organization-branding/palette';
import { applyLogoPalette } from '../organization-branding/resolve-brand';
import { NEUTRAL_BRANDING, type LocalBrandAssets, type OrganizationBranding } from '../organization-branding/types';

const BLANCO = { r: 255, g: 255, b: 255 };

/** Construye un bitmap BGRA a partir de una lista de colores RGB opacos. */
function bitmap(colors: { r: number; g: number; b: number; alpha?: number }[]): Buffer {
  const buffer = Buffer.alloc(colors.length * 4);
  colors.forEach((color, index) => {
    const offset = index * 4;
    buffer[offset] = color.b;
    buffer[offset + 1] = color.g;
    buffer[offset + 2] = color.r;
    buffer[offset + 3] = color.alpha ?? 255;
  });
  return buffer;
}

function repetir(color: { r: number; g: number; b: number; alpha?: number }, veces: number) {
  return Array.from({ length: veces }, () => color);
}

describe('extraccion de paleta del logo', () => {
  it('toma el color dominante del logo', () => {
    const rojo = { r: 200, g: 30, b: 40 };
    const pixels = bitmap([...repetir(rojo, 90), ...repetir({ r: 20, g: 60, b: 180 }, 10)]);

    const palette = extractPaletteFromBgra(pixels, 100, 1);

    expect(palette).not.toBeNull();
    expect(parseHex(palette!.primary)).toMatchObject({ r: 200, g: 30, b: 40 });
  });

  it('distingue varios colores de marca por frecuencia', () => {
    const pixels = bitmap([
      ...repetir({ r: 200, g: 30, b: 40 }, 60),
      ...repetir({ r: 20, g: 60, b: 180 }, 30),
      ...repetir({ r: 240, g: 180, b: 20 }, 10),
    ]);

    const palette = extractPaletteFromBgra(pixels, 100, 1);

    expect(palette!.all.length).toBeGreaterThanOrEqual(3);
    expect(palette!.primary).not.toBe(palette!.secondary);
    expect(palette!.secondary).not.toBe(palette!.accent);
  });

  it('ignora el fondo blanco y el negro del contorno', () => {
    const pixels = bitmap([
      ...repetir({ r: 255, g: 255, b: 255 }, 80),
      ...repetir({ r: 0, g: 0, b: 0 }, 15),
      ...repetir({ r: 200, g: 30, b: 40 }, 5),
    ]);

    const palette = extractPaletteFromBgra(pixels, 100, 1);

    expect(parseHex(palette!.primary)).toMatchObject({ r: 200, g: 30, b: 40 });
  });

  it('ignora los pixeles transparentes del PNG', () => {
    const pixels = bitmap([
      ...repetir({ r: 20, g: 200, b: 90, alpha: 0 }, 90),
      ...repetir({ r: 200, g: 30, b: 40 }, 10),
    ]);

    const palette = extractPaletteFromBgra(pixels, 100, 1);

    expect(parseHex(palette!.primary)).toMatchObject({ r: 200, g: 30, b: 40 });
  });

  it('devuelve null con un logo monocromo sin color utilizable', () => {
    const pixels = bitmap([...repetir({ r: 0, g: 0, b: 0 }, 50), ...repetir({ r: 255, g: 255, b: 255 }, 50)]);

    expect(extractPaletteFromBgra(pixels, 100, 1)).toBeNull();
  });

  it('deriva apoyos del tono cuando el logo es de un solo color', () => {
    const pixels = bitmap(repetir({ r: 200, g: 30, b: 40 }, 100));

    const palette = extractPaletteFromBgra(pixels, 100, 1);

    expect(palette!.secondary).not.toBe(palette!.primary);
    expect(palette!.accent).not.toBe(palette!.primary);
  });

  it('agrupa tonos casi iguales del antialiasing', () => {
    const pixels = bitmap([
      ...repetir({ r: 200, g: 30, b: 40 }, 50),
      ...repetir({ r: 201, g: 31, b: 41 }, 50),
    ]);

    const palette = extractPaletteFromBgra(pixels, 100, 1);

    expect(palette!.all).toHaveLength(1);
  });

  it('rechaza un bitmap incoherente con sus dimensiones', () => {
    expect(extractPaletteFromBgra(Buffer.alloc(8), 100, 100)).toBeNull();
    expect(extractPaletteFromBgra(Buffer.alloc(0), 0, 0)).toBeNull();
  });
});

describe('contraste de los colores aplicados', () => {
  it('oscurece un amarillo hasta que se lee sobre blanco', () => {
    const amarillo = { r: 250, g: 220, b: 20 };
    expect(contrastRatio(amarillo, BLANCO)).toBeLessThan(4.5);

    const corregido = ensureContrast(amarillo, BLANCO, 4.5);

    expect(contrastRatio(corregido, BLANCO)).toBeGreaterThanOrEqual(4.5);
  });

  it('no toca un color que ya contrasta', () => {
    const azulOscuro = { r: 20, g: 40, b: 120 };

    expect(ensureContrast(azulOscuro, BLANCO, 4.5)).toEqual(azulOscuro);
  });

  it('aclara u oscurece conservando el sentido', () => {
    const base = { r: 100, g: 100, b: 100 };

    expect(shade(base, 0.5).r).toBeGreaterThan(base.r);
    expect(shade(base, -0.5).r).toBeLessThan(base.r);
  });

  it('convierte a hexadecimal de seis digitos', () => {
    expect(toHex({ r: 0, g: 128, b: 255 })).toBe('#0080ff');
    expect(parseHex('#0080FF')).toEqual({ r: 0, g: 128, b: 255 });
    expect(parseHex('no es color')).toBeNull();
  });
});

describe('aplicacion de la paleta del logo', () => {
  const assets: LocalBrandAssets = {
    logo: 'assets/logo.png',
    banner: null,
    missing: [],
    logoAbsolutePath: '/tmp/ws/assets/logo.svg',
  };

  function branding(overrides: Partial<OrganizationBranding> = {}): OrganizationBranding {
    return {
      ...NEUTRAL_BRANDING,
      enabled: true,
      colorPrimary: '#3b82f6',
      colorSecondary: '#10b981',
      colorAccent: '#8b5cf6',
      colorSource: 'declarado',
      ...overrides,
    };
  }

  it('no toca la paleta si la organizacion configuro colores propios', () => {
    const propio = branding({ colorPrimary: '#c81e28' });

    expect(applyLogoPalette(propio, assets).colorSource).toBe('declarado');
  });

  it('no aplica nada si el branding esta deshabilitado', () => {
    const resultado = applyLogoPalette(branding({ enabled: false }), assets);

    expect(resultado.colorSource).not.toBe('logo');
  });

  it('no aplica nada si no hay logo descargado', () => {
    const resultado = applyLogoPalette(branding(), { ...assets, logoAbsolutePath: null });

    expect(resultado.colorSource).toBe('declarado');
  });

  it('un logo SVG no rompe la resolucion: conserva lo declarado', () => {
    // `nativeImage` no decodifica SVG; el camino debe degradar sin lanzar.
    const resultado = applyLogoPalette(branding(), assets);

    expect(resultado.colorPrimary).toBe('#3b82f6');
  });
});
