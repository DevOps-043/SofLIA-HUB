import type { DocumentBranding } from '../../src/shared/document-branding';

/** Solo bitmaps: elimina metadatos, acota decodificación y nunca evalúa SVG. */
export async function normalizeDocumentLogo(buffer: Buffer): Promise<NonNullable<DocumentBranding['logo']>> {
  const bitmap = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    || /^GIF8[79]a/.test(buffer.toString('ascii', 0, 6))
    || (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP');
  if (!bitmap) throw new Error('Formato de logo no admitido.');
  const sharp = (await import('sharp')).default;
  const image = sharp(buffer, { limitInputPixels: 16_000_000 });
  const metadata = await image.metadata();
  if (!['png', 'jpeg', 'webp', 'gif'].includes(metadata.format ?? '')) throw new Error('Formato de logo no admitido.');
  const { data, info } = await image.resize({ width: 480, height: 240, fit: 'inside', withoutEnlargement: true })
    .png({ palette: true, colours: 256, compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  if (data.length > 65_536) throw new Error('Logo demasiado grande.');
  return { png: data, width: info.width, height: info.height };
}
