import { desktopCapturer, screen as electronScreen } from 'electron';
import type { ScreenshotLayout, ScreenshotVirtualBounds } from './types';
import type { SharpModule } from './sharp-types';
import { buildScreenshotLayout } from './screenshot-layout';
import { getDisplayExtractRegion } from './screenshot-capture-region';

type CaptureSource = Awaited<ReturnType<typeof desktopCapturer.getSources>>[number];

export type CompositeScreenshot = { base64: string; layout: ScreenshotLayout; actualWidth: number; actualHeight: number };

type CaptureCompositeOptions = {
  targetWidth: number;
  targetHeight: number;
  sharpModule: SharpModule | null;
  getFocusedCaptureBounds: () => Promise<ScreenshotVirtualBounds | null>;
};

export async function captureCompositeScreenshot(options: CaptureCompositeOptions): Promise<CompositeScreenshot> {
  const thumbnailSize = {
    width: Math.max(options.targetWidth, 1600),
    height: Math.max(options.targetHeight, 900),
  };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  if (sources.length === 0) throw new Error('No se encontraron pantallas.');

  const layout = buildScreenshotLayout({
    displays: electronScreen.getAllDisplays(),
    targetWidth: options.targetWidth,
    targetHeight: options.targetHeight,
    captureBounds: await options.getFocusedCaptureBounds(),
  });

  if (!options.sharpModule || sources.length === 1) {
    return buildFallbackCapture(sources[0], layout, options.targetWidth, options.targetHeight);
  }

  const composites = await buildDisplayComposites(sources, layout, thumbnailSize, options.sharpModule);
  const result = await options.sharpModule({
    create: {
      width: options.targetWidth,
      height: options.targetHeight,
      channels: 4,
      background: { r: 18, g: 18, b: 18, alpha: 1 },
    },
  }).composite(composites).png().toBuffer();

  return {
    base64: result.toString('base64'),
    layout,
    actualWidth: options.targetWidth,
    actualHeight: options.targetHeight,
  };
}

function buildFallbackCapture(
  source: CaptureSource,
  layout: ScreenshotLayout,
  targetWidth: number,
  targetHeight: number,
): CompositeScreenshot {
  const fallback = source.thumbnail;
  const fallbackSize = fallback.getSize();
  return {
    base64: fallback.toDataURL().replace(/^data:image\/png;base64,/, ''),
    layout,
    actualWidth: fallbackSize.width || targetWidth,
    actualHeight: fallbackSize.height || targetHeight,
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
