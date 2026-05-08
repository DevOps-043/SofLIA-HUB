import type { ScreenshotLayout } from './types';
import type { CompositeScreenshot } from './screenshot-capture';
import type { SharpModule } from './sharp-types';

type Point = { x: number; y: number };

type ZoomScreenshotOptions = {
  sharpModule: SharpModule | null;
  centerX: number;
  centerY: number;
  radius: number;
  screenshotWidth: number;
  zoomResolution: number;
  captureCompositeScreenshot: (targetWidth: number, targetHeight: number) => Promise<CompositeScreenshot>;
  mapScreenshotToDipPoint: (x: number, y: number) => Point | null;
  mapDipPointToScreenshotPoint: (x: number, y: number, layout: ScreenshotLayout | null) => Point | null;
  takeScreenshotRaw: () => Promise<string>;
};

export async function createZoomScreenshot(options: ZoomScreenshotOptions): Promise<string> {
  if (!options.sharpModule) {
    console.warn('[DesktopAgent] Zoom requiere sharp; retornando screenshot completo');
    return options.takeScreenshotRaw();
  }

  const zoomDipPoint = options.mapScreenshotToDipPoint(options.centerX, options.centerY);
  const zoomCapture = await options.captureCompositeScreenshot(1920, 1080);
  const zoomBuffer = Buffer.from(zoomCapture.base64, 'base64');
  const zoomMeta = await options.sharpModule(zoomBuffer).metadata();
  const zoomFullW = zoomMeta.width || 1920;
  const zoomFullH = zoomMeta.height || 1080;
  const zoomMappedPoint = zoomDipPoint
    ? options.mapDipPointToScreenshotPoint(zoomDipPoint.x, zoomDipPoint.y, zoomCapture.layout)
    : null;
  const zoomFx = Math.round(zoomMappedPoint?.x ?? (zoomFullW / 2));
  const zoomFy = Math.round(zoomMappedPoint?.y ?? (zoomFullH / 2));
  const zoomFr = Math.round((options.radius / options.screenshotWidth) * zoomFullW);
  const crop = getZoomCrop(zoomFx, zoomFy, zoomFr, zoomFullW, zoomFullH);
  const zoomSize = options.zoomResolution;

  let cropped = await options.sharpModule(zoomBuffer)
    .extract(crop)
    .resize(zoomSize, zoomSize, { fit: 'fill' })
    .toBuffer();

  const gridSvg = Buffer.from(`<svg width="${zoomSize}" height="${zoomSize}" xmlns="http://www.w3.org/2000/svg">${buildZoomGrid(zoomSize)}</svg>`);
  cropped = await options.sharpModule(cropped).composite([{ input: gridSvg, top: 0, left: 0 }]).toBuffer();
  return cropped.toString('base64');
}

function getZoomCrop(centerX: number, centerY: number, radius: number, fullWidth: number, fullHeight: number) {
  const left = Math.max(0, centerX - radius);
  const top = Math.max(0, centerY - radius);
  return {
    left,
    top,
    width: Math.min(radius * 2, fullWidth - left),
    height: Math.min(radius * 2, fullHeight - top),
  };
}

function buildZoomGrid(size: number): string {
  const fineStep = 25;
  let grid = '';
  for (let x = 0; x < size; x += fineStep) {
    grid += `<line x1="${x}" y1="0" x2="${x}" y2="${size}" stroke="rgba(0, 120, 255, 0.15)" stroke-width="1" />`;
  }
  for (let y = 0; y < size; y += fineStep) {
    grid += `<line x1="0" y1="${y}" x2="${size}" y2="${y}" stroke="rgba(0, 120, 255, 0.15)" stroke-width="1" />`;
  }
  grid += `<line x1="${size / 2}" y1="0" x2="${size / 2}" y2="${size}" stroke="rgba(255, 0, 0, 0.4)" stroke-width="1" />`;
  grid += `<line x1="0" y1="${size / 2}" x2="${size}" y2="${size / 2}" stroke="rgba(255, 0, 0, 0.4)" stroke-width="1" />`;
  return grid;
}
