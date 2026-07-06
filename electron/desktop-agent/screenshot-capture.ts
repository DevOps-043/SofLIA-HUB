import { desktopCapturer, screen as electronScreen } from 'electron';
import type { ScreenshotLayout, ScreenshotVirtualBounds } from './types';
import type { SharpModule } from './sharp-types';
import { buildScreenshotLayout, computeAdaptiveTargetSize, getVirtualDesktopBounds } from './screenshot-layout';
import { getDisplayExtractRegion } from './screenshot-capture-region';

type CaptureSource = Awaited<ReturnType<typeof desktopCapturer.getSources>>[number];

export type CompositeScreenshot = { base64: string; layout: ScreenshotLayout; actualWidth: number; actualHeight: number };

type CaptureCompositeOptions = {
  targetWidth: number;
  targetHeight: number;
  sharpModule: SharpModule | null;
  getCaptureBounds: () => Promise<ScreenshotVirtualBounds | null>;
  /** Resolucion adaptativa: garantiza renderScale >= minRenderScale acotado por maxScreenshotEdge. */
  minRenderScale?: number;
  maxScreenshotEdge?: number;
};

export async function captureCompositeScreenshot(options: CaptureCompositeOptions): Promise<CompositeScreenshot> {
  const displays = electronScreen.getAllDisplays();
  const captureBounds = await options.getCaptureBounds();
  const effectiveBounds = captureBounds ?? getVirtualDesktopBounds(displays);
  const target = options.minRenderScale && options.maxScreenshotEdge
    ? computeAdaptiveTargetSize(effectiveBounds, {
      targetWidth: options.targetWidth,
      targetHeight: options.targetHeight,
      minRenderScale: options.minRenderScale,
      maxScreenshotEdge: options.maxScreenshotEdge,
    })
    : { width: options.targetWidth, height: options.targetHeight };

  const thumbnailSize = {
    width: Math.max(target.width, 1600),
    height: Math.max(target.height, 900),
  };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  if (sources.length === 0) throw new Error('No se encontraron pantallas.');

  const layout = buildScreenshotLayout({
    displays,
    targetWidth: target.width,
    targetHeight: target.height,
    captureBounds,
  });

  if (!options.sharpModule) {
    return buildFallbackCapture(sources[0], target.width, target.height);
  }

  const composites = await buildDisplayComposites(sources, layout, thumbnailSize, options.sharpModule);
  const result = await options.sharpModule({
    create: {
      width: target.width,
      height: target.height,
      channels: 4,
      background: { r: 18, g: 18, b: 18, alpha: 1 },
    },
  }).composite(composites).png().toBuffer();

  return {
    base64: result.toString('base64'),
    layout,
    actualWidth: target.width,
    actualHeight: target.height,
  };
}

/**
 * Sin Sharp no se puede recortar/componer: se devuelve el thumbnail completo
 * de la primera pantalla y se RECONSTRUYE el layout para que describa
 * exactamente esa imagen (nunca un layout de recorte con imagen completa).
 */
function buildFallbackCapture(
  source: CaptureSource,
  targetWidth: number,
  targetHeight: number,
): CompositeScreenshot {
  const fallback = source.thumbnail;
  const fallbackSize = fallback.getSize();
  const actualWidth = fallbackSize.width || targetWidth;
  const actualHeight = fallbackSize.height || targetHeight;

  const displays = electronScreen.getAllDisplays();
  const sourceDisplay = displays.find((display) => String(display.id) === String(source.display_id)) ?? displays[0];
  const layout = buildScreenshotLayout({
    displays: sourceDisplay ? [sourceDisplay] : displays,
    targetWidth: actualWidth,
    targetHeight: actualHeight,
    captureBounds: sourceDisplay ? { ...sourceDisplay.bounds } : null,
  });

  return {
    base64: fallback.toDataURL().replace(/^data:image\/png;base64,/, ''),
    layout,
    actualWidth,
    actualHeight,
  };
}

async function buildDisplayComposites(
  sources: CaptureSource[],
  layout: ScreenshotLayout,
  thumbnailSize: { width: number; height: number },
  sharpModule: SharpModule,
) {
  const sourceByDisplayId = new Map(sources.filter((source) => source.display_id).map((source) => [String(source.display_id), source]));
  const displayById = new Map(electronScreen.getAllDisplays().map((display) => [String(display.id), display]));
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];

  for (const [index, region] of layout.displayRegions.entries()) {
    const source = sourceByDisplayId.get(region.displayId) || sources[index] || sources[0];
    const display = displayById.get(region.displayId);
    let pipeline = sharpModule(source.thumbnail.toPNG());
    if (display) {
      pipeline = pipeline.extract(await getDisplayExtractRegion(source, display, region.bounds, thumbnailSize, sharpModule));
    }
    composites.push({
      input: await pipeline.resize(region.width, region.height, { fit: 'fill' }).toBuffer(),
      left: region.left,
      top: region.top,
    });
  }

  return composites;
}
