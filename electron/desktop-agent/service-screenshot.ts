import { getFocusedCaptureBounds as resolveFocusedCaptureBounds } from './focused-capture-bounds';
import { resolveCaptureBounds } from './capture-strategy';
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

/**
 * Proposito de cada captura:
 * - 'decision': la imagen que vera el modelo; actualiza el layout activo del paso.
 * - 'verification' | 'zoom': capturas auxiliares; con layoutBindingEnabled NO
 *   mutan el estado del servicio, evitando que un screenshot de verificacion
 *   desincronice las coordenadas de una accion decidida sobre otra imagen.
 */
export type CapturePurpose = 'decision' | 'verification' | 'zoom';

export interface DesktopAgentScreenshotApi {
  takeScreenshot(fullRes?: boolean): Promise<string>;
  takeScreenshotWithMarks(): Promise<{ screenshot: string; elements: UIElement[]; mode: 'som' | 'grid'; layout: ScreenshotLayout | null }>;
  takeScreenshotRaw(): Promise<string>;
  takeScreenshotForVerification(): Promise<string>;
  applyGridOverlay(base64: string, width: number, height: number): Promise<string>;
  applySoMOverlay(base64: string, width: number, height: number, elements: UIElement[]): Promise<string>;
  takeZoomScreenshot(centerX: number, centerY: number, radius?: number): Promise<string>;
  getVirtualDesktopBounds(): ScreenshotVirtualBounds;
  getFocusedCaptureBounds(): Promise<ScreenshotVirtualBounds | null>;
  buildScreenshotLayout(targetWidth: number, targetHeight: number, captureBounds?: ScreenshotVirtualBounds | null): ScreenshotLayout;
  captureCompositeScreenshot(targetWidth: number, targetHeight: number, options?: { purpose?: CapturePurpose }): Promise<CompositeScreenshotResult>;
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
        takeScreenshotRawDetailed: async () => {
          const composite = await this.captureCompositeScreenshot(this.config.screenshotWidth, this.config.screenshotHeight);
          this.lastDecisionCapture = composite;
          this.updateScreenScale(composite.actualWidth, composite.actualHeight);
          return composite;
        },
        getUIElements: (captura) => this.getUIElements(captura),
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
    async takeScreenshotForVerification() {
      if (!this.config.layoutBindingEnabled) return this.takeScreenshotRaw();
      const composite = await this.captureCompositeScreenshot(
        this.config.screenshotWidth,
        this.config.screenshotHeight,
        { purpose: 'verification' },
      );
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
        screenshotWidth: this.lastActualScreenshotWidth || this.config.screenshotWidth,
        zoomResolution: this.config.zoomResolution,
        captureCompositeScreenshot: (width, height) => this.captureCompositeScreenshot(width, height, { purpose: 'zoom' }),
        mapScreenshotToDipPoint: (x, y) => this.mapScreenshotToDipPoint(x, y),
        mapDipPointToScreenshotPoint: (x, y, layout) => this.mapDipPointToScreenshotPoint(x, y, layout),
        takeScreenshotRaw: () => this.takeScreenshotForVerification(),
      });
    },
    getVirtualDesktopBounds: () => getVirtualDesktopBounds(),
    getFocusedCaptureBounds() {
      return resolveFocusedCaptureBounds(this.config, (script, timeout) => this.psEncoded(script, timeout));
    },
    buildScreenshotLayout(targetWidth, targetHeight, captureBounds) {
      return buildScreenshotLayout({ targetWidth, targetHeight, captureBounds });
    },
    async captureCompositeScreenshot(targetWidth, targetHeight, options) {
      const purpose: CapturePurpose = options?.purpose ?? 'decision';
      const captured = await captureDesktopScreenshot({
        targetWidth,
        targetHeight,
        sharpModule,
        getCaptureBounds: async () => {
          const resolved = await resolveCaptureBounds({
            config: this.config,
            psEncoded: (script, timeout) => this.psEncoded(script, timeout),
          });
          return resolved.bounds;
        },
        minRenderScale: this.config.minRenderScale,
        maxScreenshotEdge: this.config.maxScreenshotEdge,
      });

      const bindingEnabled = this.config.layoutBindingEnabled;
      if (!bindingEnabled || purpose === 'decision') {
        this.lastScreenshotLayout = captured.layout;
        this.lastActualScreenshotWidth = captured.actualWidth;
        this.lastActualScreenshotHeight = captured.actualHeight;
        if (bindingEnabled) this.activeStepLayout = captured.layout;
      }
      return captured;
    },
  } satisfies DesktopAgentScreenshotApi & ThisType<DesktopAgentService>);
}
