import type { DesktopAgentConfig, UIElement } from '../desktop-agent-types';
import type { ScreenshotLayout } from './types';

type CompositeScreenshot = {
  base64: string;
  layout: ScreenshotLayout;
  actualWidth: number;
  actualHeight: number;
};

export async function takeDesktopAgentScreenshot(params: {
  fullRes: boolean;
  config: DesktopAgentConfig;
  captureCompositeScreenshot: (width: number, height: number) => Promise<CompositeScreenshot>;
  updateScreenScale: (width: number, height: number) => void;
  applyGridOverlay: (base64: string, width: number, height: number) => Promise<string>;
}): Promise<string> {
  const captureTarget = params.fullRes
    ? { width: 1920, height: 1080 }
    : { width: params.config.screenshotWidth, height: params.config.screenshotHeight };
  const captured = await params.captureCompositeScreenshot(captureTarget.width, captureTarget.height);

  if (!params.fullRes) {
    params.updateScreenScale(captured.actualWidth, captured.actualHeight);
  }

  if (!params.config.gridEnabled || params.fullRes) {
    return captured.base64;
  }

  try {
    return await params.applyGridOverlay(captured.base64, captured.actualWidth, captured.actualHeight);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[DesktopAgent] Grid overlay fallo, usando raw:', message);
    return captured.base64;
  }
}

export async function takeMarkedDesktopAgentScreenshot(params: {
  config: DesktopAgentConfig;
  takeScreenshotRaw: () => Promise<string>;
  getUIElements: () => Promise<UIElement[]>;
  applySoMOverlay: (base64: string, width: number, height: number, elements: UIElement[]) => Promise<string>;
  applyGridOverlay: (base64: string, width: number, height: number) => Promise<string>;
  setCaptureState: (elements: UIElement[], mode: 'som' | 'grid') => void;
}): Promise<{ screenshot: string; elements: UIElement[]; mode: 'som' | 'grid' }> {
  const rawScreenshot = await params.takeScreenshotRaw();
  const width = params.config.screenshotWidth;
  const height = params.config.screenshotHeight;

  if (params.config.somEnabled) {
    try {
      const elements = await params.getUIElements();
      if (elements.length >= 3) {
        const marked = await params.applySoMOverlay(rawScreenshot, width, height, elements);
        params.setCaptureState(elements, 'som');
        return { screenshot: marked, elements, mode: 'som' };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[DesktopAgent] SoM overlay fallo, fallback a grid:', message);
    }
  }

  params.setCaptureState([], 'grid');
  const screenshot = params.config.gridEnabled
    ? await params.applyGridOverlay(rawScreenshot, width, height).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[DesktopAgent] Grid fallback fallo:', message);
      return rawScreenshot;
    })
    : rawScreenshot;
  return { screenshot, elements: [], mode: 'grid' };
}
