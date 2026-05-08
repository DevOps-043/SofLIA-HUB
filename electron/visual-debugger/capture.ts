import { desktopCapturer, screen } from 'electron';
import { getSharp } from './sharp-loader';

export interface VisualScreenCapture {
  screenshotBuffer: Buffer;
  captureWidth: number;
  captureHeight: number;
  imgWidth: number;
  imgHeight: number;
  scaleFactor: number;
}

export async function capturePrimaryScreen(): Promise<VisualScreenCapture> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor;
  const captureWidth = Math.floor(screenWidth * scaleFactor);
  const captureHeight = Math.floor(screenHeight * scaleFactor);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: captureWidth, height: captureHeight },
  });
  if (!sources || sources.length === 0) {
    throw new Error('No se encontraron fuentes de pantalla disponibles para capturar.');
  }

  const screenshotBuffer = sources[0].thumbnail.toPNG();
  const metadata = await getSharp()(screenshotBuffer).metadata();
  return {
    screenshotBuffer,
    captureWidth,
    captureHeight,
    imgWidth: metadata.width || captureWidth,
    imgHeight: metadata.height || captureHeight,
    scaleFactor,
  };
}
