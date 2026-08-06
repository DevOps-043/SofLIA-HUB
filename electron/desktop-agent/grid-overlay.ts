// El tipo estructural del proyecto no depende de la forma del modulo, que
// cambio en sharp 0.35 al pasar a exportaciones duales ESM/CJS.
import type { SharpFactory } from './sharp-types';

export async function applyGridOverlay(params: {
  sharpModule: SharpFactory | null;
  base64: string;
  fallbackWidth: number;
  fallbackHeight: number;
  gridStep: number;
}): Promise<string> {
  const { sharpModule, base64, fallbackWidth, fallbackHeight, gridStep } = params;
  if (!sharpModule) return base64;

  const pngBuffer = Buffer.from(base64, 'base64');
  const meta = await sharpModule(pngBuffer).metadata();
  const width = meta.width || fallbackWidth;
  const height = meta.height || fallbackHeight;

  let svgElements = '';
  for (let x = 0; x < width; x += gridStep) {
    svgElements += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`;
    svgElements += `<text x="${x + 2}" y="12" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${x}</text>`;
  }
  for (let y = 0; y < height; y += gridStep) {
    svgElements += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`;
    svgElements += `<text x="2" y="${y + 12}" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${y}</text>`;
  }

  const svgOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`);
  const result = await sharpModule(pngBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]).toBuffer();
  return result.toString('base64');
}
