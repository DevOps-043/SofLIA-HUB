import { nativeImage } from 'electron';
import path from 'node:path';
import { extractPaletteFromBgra, type ExtractedPalette } from './palette';

/**
 * Adaptador que decodifica el archivo del logo y delega en el extractor puro.
 *
 * Usa `nativeImage` de Electron: ya viene con el runtime y decodifica PNG,
 * JPEG y WebP sin agregar dependencias. No soporta SVG, asi que un logo
 * vectorial cae al camino de los colores declarados.
 */

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export function extractPaletteFromLogoFile(absolutePath: string): ExtractedPalette | null {
  const extension = path.extname(absolutePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    // SVG y formatos que `nativeImage` no decodifica: no es un error, solo
    // significa que la paleta se resuelve por el camino declarado.
    return null;
  }

  try {
    const image = nativeImage.createFromPath(absolutePath);
    if (image.isEmpty()) return null;

    const { width, height } = image.getSize();
    if (width <= 0 || height <= 0) return null;

    // El .d.ts de Electron declara `getBitmap(): void`, pero en runtime
    // devuelve un Buffer BGRA. El cast acota ese error del typing en un solo
    // punto en vez de propagarlo.
    const bitmap = (image.getBitmap as unknown as () => Buffer)();
    if (!bitmap || bitmap.length === 0) return null;

    return extractPaletteFromBgra(bitmap, width, height);
  } catch (error) {
    console.warn('[BrandPalette] No se pudo leer el logo:', error instanceof Error ? error.message : error);
    return null;
  }
}
