import type { UIElement } from '../desktop-agent-types';
import type { SharpFactory } from './sharp-types';

type ScreenshotRect = { x: number; y: number; width: number; height: number };

const MARKER_COLOR_BY_CONTROL: Record<string, string> = {
  Button: '#22c55e',
  TextBox: '#3b82f6',
  Edit: '#3b82f6',
  MenuItem: '#f97316',
  ComboBox: '#a855f7',
  ListItem: '#06b6d4',
  Link: '#ec4899',
  CheckBox: '#eab308',
  RadioButton: '#eab308',
};

/**
 * Tamano real de la imagen sobre la que se dibuja. Se entrega a `mapRect`
 * porque quien traduce coordenadas suele necesitar la escala y solo aqui se
 * conoce: la captura puede venir reducida respecto del origen que la produjo.
 */
export type OverlayImageSize = { width: number; height: number };

export async function applyGridOverlay(
  sharp: SharpFactory | null,
  base64: string,
  fallbackWidth: number,
  fallbackHeight: number,
  step: number,
): Promise<string> {
  if (!sharp) return base64;
  const pngBuffer = Buffer.from(base64, 'base64');
  const meta = await sharp(pngBuffer).metadata();
  const width = meta.width || fallbackWidth;
  const height = meta.height || fallbackHeight;
  let svgElements = '';

  for (let x = 0; x < width; x += step) {
    svgElements += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`;
    svgElements += `<text x="${x + 2}" y="12" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${x}</text>`;
  }
  for (let y = 0; y < height; y += step) {
    svgElements += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255, 0, 0, 0.2)" stroke-width="1" />`;
    svgElements += `<text x="2" y="${y + 12}" fill="rgba(255, 0, 0, 0.6)" font-size="10" font-family="monospace">${y}</text>`;
  }

  const svgOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`);
  return (await sharp(pngBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]).toBuffer()).toString('base64');
}

export async function applySoMOverlay(input: {
  sharp: SharpFactory | null;
  base64: string;
  fallbackWidth: number;
  fallbackHeight: number;
  elements: UIElement[];
  mapRect: (rect: UIElement['boundingRect'], imagen: OverlayImageSize) => ScreenshotRect | null;
}): Promise<string> {
  const { sharp, base64, fallbackWidth, fallbackHeight, elements, mapRect } = input;
  if (!sharp) return base64;
  const pngBuffer = Buffer.from(base64, 'base64');
  const meta = await sharp(pngBuffer).metadata();
  const width = meta.width || fallbackWidth;
  const height = meta.height || fallbackHeight;
  let svgElements = '';

  for (const element of elements.slice(0, 30)) {
    const mappedRect = mapRect(element.boundingRect, { width, height });
    if (!mappedRect) continue;
    const bx = Math.round(mappedRect.x);
    const by = Math.round(mappedRect.y);
    const bw = Math.max(Math.round(mappedRect.width), 8);
    const bh = Math.max(Math.round(mappedRect.height), 8);
    const color = MARKER_COLOR_BY_CONTROL[element.controlType] || '#ef4444';
    const labelWidth = String(element.id).length * 8 + 6;

    svgElements += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="${color}" stroke-width="2" rx="2"/>`;
    svgElements += `<rect x="${bx}" y="${Math.max(0, by - 14)}" width="${labelWidth}" height="14" fill="${color}" rx="2"/>`;
    svgElements += `<text x="${bx + 3}" y="${Math.max(10, by - 3)}" fill="white" font-size="10" font-weight="bold" font-family="monospace">${element.id}</text>`;
  }

  const svgOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`);
  return (await sharp(pngBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]).toBuffer()).toString('base64');
}
