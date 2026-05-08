import type { ScreenshotVirtualBounds } from './types';
import type { SharpModule } from './sharp-types';

type ThumbnailSource = {
  thumbnail: {
    toPNG(): Buffer;
  };
};

type ThumbnailSize = { width: number; height: number };
type ExtractRegion = { left: number; top: number; width: number; height: number };

export async function getDisplayExtractRegion(
  source: ThumbnailSource,
  display: Electron.Display,
  bounds: ScreenshotVirtualBounds,
  thumbnailSize: ThumbnailSize,
  sharpModule: SharpModule,
): Promise<ExtractRegion> {
  const metadata = await sharpModule(source.thumbnail.toPNG()).metadata();
  const sourceWidth = metadata.width || thumbnailSize.width;
  const sourceHeight = metadata.height || thumbnailSize.height;
  const scaleX = sourceWidth / Math.max(1, display.bounds.width);
  const scaleY = sourceHeight / Math.max(1, display.bounds.height);
  const cropLeft = Math.max(0, bounds.x - display.bounds.x);
  const cropTop = Math.max(0, bounds.y - display.bounds.y);
  const cropWidth = Math.min(bounds.width, display.bounds.width - cropLeft);
  const cropHeight = Math.min(bounds.height, display.bounds.height - cropTop);
  const left = Math.max(0, Math.min(sourceWidth - 1, Math.round(cropLeft * scaleX)));
  const top = Math.max(0, Math.min(sourceHeight - 1, Math.round(cropTop * scaleY)));

  return {
    left,
    top,
    width: Math.max(1, Math.min(sourceWidth - left, Math.round(cropWidth * scaleX))),
    height: Math.max(1, Math.min(sourceHeight - top, Math.round(cropHeight * scaleY))),
  };
}
