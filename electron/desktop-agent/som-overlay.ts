import type { UIElement } from '../desktop-agent-types';

type Rect = { x: number; y: number; width: number; height: number };
type SharpFactory = typeof import('sharp');

const MARKER_COLORS: Record<string, string> = {
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

export async function applySoMOverlay(params: {
  sharpModule: SharpFactory | null;
  base64: string;
  fallbackWidth: number;
  fallbackHeight: number;
  elements: UIElement[];
  mapRect: (rect: Rect) => Rect | null;
}): Promise<string> {
  const { sharpModule, base64, fallbackWidth, fallbackHeight, elements, mapRect } = params;
  if (!sharpModule) return base64;

  const pngBuffer = Buffer.from(base64, 'base64');
  const meta = await sharpModule(pngBuffer).metadata();
  const width = meta.width || fallbackWidth;
  const height = meta.height || fallbackHeight;

  let svgElements = '';
  for (const element of elements.slice(0, 30)) {
    const mappedRect = mapRect(element.boundingRect);
    if (!mappedRect) continue;

    const bx = Math.round(mappedRect.x);
    const by = Math.round(mappedRect.y);
    const bw = Math.max(Math.round(mappedRect.width), 8);
    const bh = Math.max(Math.round(mappedRect.height), 8);
    const color = MARKER_COLORS[element.controlType] || '#ef4444';
    const labelWidth = String(element.id).length * 8 + 6;
    const labelY = Math.max(0, by - 14);
    const textY = Math.max(10, by - 3);

    svgElements += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="${color}" stroke-width="2" rx="2"/>`;
    svgElements += `<rect x="${bx}" y="${labelY}" width="${labelWidth}" height="14" fill="${color}" rx="2"/>`;
    svgElements += `<text x="${bx + 3}" y="${textY}" fill="white" font-size="10" font-weight="bold" font-family="monospace">${element.id}</text>`;
  }

  const svgOverlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`);
  const result = await sharpModule(pngBuffer).composite([{ input: svgOverlay, top: 0, left: 0 }]).toBuffer();
  return result.toString('base64');
}
