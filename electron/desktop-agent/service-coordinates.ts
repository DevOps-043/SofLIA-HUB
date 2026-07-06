import { app as electronApp, screen as electronScreen } from 'electron';
import { dipToScreenPoint as convertDipToScreenPoint, getDisplayRegionLabelFromScreenshotPoint, mapDesktopPointToScreenshotPoint as mapDesktopPointToScreenshot, mapDesktopRectToScreenshotRect as mapDesktopRectToScreenshot, mapDipPointToScreenshotPoint as mapDipToScreenshot, mapScreenshotToDipPoint as mapScreenshotToDip } from './screenshot-coordinates';
import { describeScreenshotMonitorContext } from './screenshot-monitor-context';
import { calculateScreenScaleState, resolveScreenPointFromState, updateScreenScaleState } from './screen-scale-state';
import { getForegroundUIElements } from './ui-elements';
import { buildDesktopElementSource, createVisualElementSource } from './element-source';
import { PowerShellWorker } from './native-worker/powershell-worker';
import { createOmniParser } from './visual-parser';
import { extractTextBoxesFromBase64 } from '../ocr-service';
import type { ElementSourceProvider } from './element-source';
import type { CompositeScreenshot } from './screenshot-capture';
import type { ScreenshotLayout } from './types';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentCoordinateApi } from './service-coordinate-api';
import type { DesktopAgentServiceConstructor } from './service-types';

export type { DesktopAgentCoordinateApi } from './service-coordinate-api';

/**
 * Layout usado para resolver coordenadas: con layoutBindingEnabled se prefiere
 * el layout de la captura de DECISION del paso (activeStepLayout), que no es
 * pisado por capturas de verificacion/zoom. Sin el flag, comportamiento legacy
 * (ultimo layout capturado).
 */
function resolveActiveLayout(service: DesktopAgentService): ScreenshotLayout | null {
  if (service.config.layoutBindingEnabled && service.activeStepLayout) return service.activeStepLayout;
  return service.lastScreenshotLayout;
}

function countDisplays(): number | undefined {
  try {
    return electronScreen.getAllDisplays().length;
  } catch {
    return undefined;
  }
}

/**
 * Proveedor visual (OmniParser/ONNX), memoizado en el servicio para conservar la
 * sesion ONNX entre pasos. Si el flag esta apagado devuelve null; si el runtime
 * o el modelo no estan, el parser reporta no-disponible y el composite sigue con
 * UIA+OCR (degradacion elegante).
 */
function resolveVisualProvider(service: DesktopAgentService): ElementSourceProvider | null {
  if (!service.config.visualParserEnabled) return null;
  if (!service.visualParser) {
    let userDataDir: string | undefined;
    try {
      userDataDir = electronApp.getPath('userData');
    } catch {
      userDataDir = undefined;
    }
    service.visualParser = createOmniParser({
      userDataDir,
      scoreThreshold: service.config.visualScoreThreshold,
      nmsIouThreshold: service.config.visualNmsIou,
    });
  }
  logVisualParserAvailability(service);
  return createVisualElementSource({
    parser: service.visualParser,
    mapImagenADip: (x, y, layout) => mapScreenshotToDip(x, y, layout),
    dipAFisico: (punto) => convertDipToScreenPoint(punto),
  });
}

function logVisualParserAvailability(service: DesktopAgentService): void {
  if (service.visualParserAvailabilityLogged) return;
  service.visualParserAvailabilityLogged = true;
  const diagnostico = service.visualParser?.diagnostico?.();
  if (!diagnostico) {
    console.log('[DesktopAgent] OmniParser/ONNX: diagnostico no disponible; se usara UIA+OCR.');
    return;
  }
  console.log('[DesktopAgent] OmniParser/ONNX:', JSON.stringify({
    disponible: diagnostico.disponible,
    runtimeDisponible: diagnostico.runtimeDisponible,
    sharpDisponible: diagnostico.sharpDisponible,
    modeloExiste: diagnostico.modeloExiste,
    modeloPath: diagnostico.modeloPath,
  }));
}

export function attachDesktopAgentCoordinates(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    dipToScreenPoint: (point) => convertDipToScreenPoint(point),
    mapScreenshotToDipPoint(x, y, layout = null) {
      return mapScreenshotToDip(x, y, layout ?? resolveActiveLayout(this));
    },
    mapDipPointToScreenshotPoint(x, y, layout = null) {
      return mapDipToScreenshot(x, y, layout ?? resolveActiveLayout(this));
    },
    mapDesktopPointToScreenshotPoint(x, y) {
      return mapDesktopPointToScreenshot(x, y, resolveActiveLayout(this));
    },
    mapDesktopRectToScreenshotRect(rect) {
      return mapDesktopRectToScreenshot(rect, resolveActiveLayout(this));
    },
    getUIElements(captura?: CompositeScreenshot) {
      // Rollback: elementSourceEnabled:false vuelve a la fuente UIA legacy
      // (spawn de 4 s de ui-elements.ts), el comportamiento previo exacto.
      if (!this.config.elementSourceEnabled) return getForegroundUIElements();

      const usaUia = process.platform === 'win32' && this.config.uiaWorkerEnabled !== false;
      if (usaUia && !this.uiaWorker) this.uiaWorker = new PowerShellWorker();

      const source = buildDesktopElementSource({
        worker: usaUia ? this.uiaWorker : null,
        // Fallback cuando no llega la captura de decision (p.ej. snapshot UIA):
        // captura de verificacion que NO pisa el layout activo del paso.
        capturar: () => this.captureCompositeScreenshot(
          this.config.screenshotWidth,
          this.config.screenshotHeight,
          { purpose: 'verification' },
        ),
        reconocerTextos: (base64) => extractTextBoxesFromBase64(base64),
        // El OCR usa el layout de la MISMA captura que se le pasa; por eso las
        // funciones puras que reciben layout explicito, no las del layout activo.
        mapImagenADip: (x, y, layout) => mapScreenshotToDip(x, y, layout),
        dipAFisico: (punto) => convertDipToScreenPoint(punto),
        visualProvider: resolveVisualProvider(this),
        config: {
          uiaWorkerEnabled: usaUia,
          ocrElementsEnabled: this.config.ocrElementsEnabled,
          maxDetectedElements: this.config.maxDetectedElements,
          elementDedupIouThreshold: this.config.elementDedupIouThreshold,
          uiaSparseThreshold: this.config.uiaSparseThreshold,
          uiaWakeDelayMs: this.config.uiaWakeDelayMs,
          sufficientElementCount: this.config.sufficientElementCount,
          visualSkipWhenUiaRich: this.config.visualSkipWhenUiaRich,
        },
      });
      return source.obtenerElementos(captura);
    },
    calculateScreenScale() {
      const state = calculateScreenScaleState({
        config: this.config,
        getVirtualDesktopBounds: () => this.getVirtualDesktopBounds(),
        buildScreenshotLayout: (width, height) => this.buildScreenshotLayout(width, height),
      });
      this.screenScale = state.screenScale;
      this.lastScreenshotLayout = state.lastScreenshotLayout;
    },
    updateScreenScale(actualWidth, actualHeight) {
      this.lastActualScreenshotWidth = actualWidth;
      this.lastActualScreenshotHeight = actualHeight;
      const state = updateScreenScaleState({
        actualWidth,
        actualHeight,
        currentScale: this.screenScale,
        lastScreenshotLayout: this.lastScreenshotLayout,
        buildScreenshotLayout: (width, height) => this.buildScreenshotLayout(width, height),
      });
      this.screenScale = state.screenScale;
      this.lastScreenshotLayout = state.lastScreenshotLayout;
    },
    getDisplayRegionLabelFromScreenshotPoint(x, y, layout = null) {
      return getDisplayRegionLabelFromScreenshotPoint(x, y, layout ?? resolveActiveLayout(this));
    },
    describeScreenshotMonitorContext(layout = null) {
      return describeScreenshotMonitorContext(
        layout ?? resolveActiveLayout(this),
        this.getVirtualDesktopBounds(),
        countDisplays(),
      );
    },
    resolveScreenPoint(x, y) {
      return resolveScreenPointFromState({
        x,
        y,
        screenScale: this.screenScale,
        legacyScaleFallbackEnabled: this.config.legacyScaleFallbackEnabled,
        mapScreenshotToDipPoint: (screenX, screenY) => this.mapScreenshotToDipPoint(screenX, screenY),
        dipToScreenPoint: (point) => this.dipToScreenPoint(point),
        getRegionLabel: (screenX, screenY) => this.getDisplayRegionLabelFromScreenshotPoint(screenX, screenY),
      });
    },
    scale(x, y) {
      const resolved = this.resolveScreenPoint(x, y);
      return { x: resolved.x, y: resolved.y };
    },
  } satisfies DesktopAgentCoordinateApi & ThisType<DesktopAgentService>);
}
