import { getFocusedCaptureBounds as resolveFocusedCaptureBounds } from './focused-capture-bounds';
import { captureCompositeScreenshot as captureDesktopScreenshot } from './screenshot-capture';
import { buildScreenshotLayout, getVirtualDesktopBounds } from './screenshot-layout';
import { applyGridOverlay, applySoMOverlay } from './screenshot-overlays';
import { loadSharp, type SharpFactory } from './sharp';
import { createZoomScreenshot } from './screenshot-zoom';
import {
  takeDesktopAgentScreenshot,
  takeMarkedDesktopAgentScreenshot,
} from './public-screenshot-api';
import type { ScreenshotLayout, ScreenshotVirtualBounds } from './types';
import type { UIElement } from '../desktop-agent-types';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { CompositeScreenshotResult, DesktopAgentServiceConstructor } from './service-types';

const sharpModule: SharpFactory | null = loadSharp();

export interface DesktopAgentScreenshotApi {
  takeScreenshot(fullRes?: boolean): Promise<string>;
  takeScreenshotWithMarks(): Promise<{ screenshot: string; elements: UIElement[]; mode: 'som' | 'grid' }>;
  takeScreenshotRaw(): Promise<string>;
  applyGridOverlay(base64: string, width: number, height: number): Promise<string>;
  applySoMOverlay(base64: string, width: number, height: number, elements: UIElement[]): Promise<string>;
  takeZoomScreenshot(centerX: number, centerY: number, radius?: number): Promise<string>;
  getVirtualDesktopBounds(): ScreenshotVirtualBounds;
  getFocusedCaptureBounds(): Promise<ScreenshotVirtualBounds | null>;
  buildScreenshotLayout(targetWidth: number, targetHeight: number, captureBounds?: ScreenshotVirtualBounds | null): ScreenshotLayout;
  captureCompositeScreenshot(targetWidth: number, targetHeight: number): Promise<CompositeScreenshotResult>;
}

export function attachDesktopAgentScreenshot(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    takeScreenshot(fullRes = false) {
      return takeDesktopAgentScreenshot({
        fullRes,
        config: this.config,
        captureCompositeScreenshot: (width, height) => this.captureCompositeScreenshot(width, height),
        updateScreenScale: (width, height) => this.updateScreenScale(width, height),
        applyGridOverlay: (base64, width, height) => this.applyGridOverlay(base64, width, height),
      });
    },
    takeScreenshotWithMarks() {
      return takeMarkedDesktopAgentScreenshot({
        config: this.config,
        takeScreenshotRaw: () => this.takeScreenshotRaw(),
        getUIElements: () => this.getUIElements(),
        applySoMOverlay: (base64, width, height, elements) => this.applySoMOverlay(base64, width, height, elements),
        applyGridOverlay: (base64, width, height) => this.applyGridOverlay(base64, width, height),
        setCaptureState: (elements, mode) => {
          this.currentUIElements = elements;
          this.captureMode = mode;
        },
      });
    },
    async takeScreenshotRaw() {
      const composite = await this.captureCompositeScreenshot(this.config.screenshotWidth, this.config.screenshotHeight);
      this.updateScreenScale(composite.actualWidth, composite.actualHeight);
      return composite.base64;
    },
    applyGridOverlay(base64, width, height) {
      return applyGridOverlay(sharpModule, base64, width, height, this.config.gridStep);
    },
    applySoMOverlay(base64, width, height, elements) {
      return applySoMOverlay({ sharp: sharpModule, base64, fallbackWidth: width, fallbackHeight: height, elements, mapRect: (rect) => this.mapDesktopRectToScreenshotRect(rect) });
    },
    takeZoomScreenshot(centerX, centerY, radius = 150) {
      return createZoomScreenshot({
        sharpModule,
        centerX,
        centerY,
        radius,
        screenshotWidth: this.config.screenshotWidth,
        zoomResolution: this.config.zoomResolution,
        captureCompositeScreenshot: (width, height) => this.captureCompositeScreenshot(width, height),
        mapScreenshotToDipPoint: (x, y) => this.mapScreenshotToDipPoint(x, y),
        mapDipPointToScreenshotPoint: (x, y, layout) => this.mapDipPointToScreenshotPoint(x, y, layout),
        takeScreenshotRaw: () => this.takeScreenshotRaw(),
      });
    },
    getVirtualDesktopBounds: () => getVirtualDesktopBounds(),
    getFocusedCaptureBounds() {
      return resolveFocusedCaptureBounds(this.config, (script, timeout) => this.psEncoded(script, timeout));
    },
    buildScreenshotLayout(targetWidth, targetHeight, captureBounds) {
      return buildScreenshotLayout({ targetWidth, targetHeight, captureBounds });
    },
    async captureCompositeScreenshot(targetWidth, targetHeight) {
      const captured = await captureDesktopScreenshot({ targetWidth, targetHeight, sharpModule, getFocusedCaptureBounds: () => this.getFocusedCaptureBounds() });
      this.lastScreenshotLayout = captured.layout;
      this.lastActualScreenshotWidth = captured.actualWidth;
      this.lastActualScreenshotHeight = captured.actualHeight;
      return captured;
    },
  } satisfies DesktopAgentScreenshotApi & ThisType<DesktopAgentService>);
}
