import { dipToScreenPoint as convertDipToScreenPoint, mapDesktopPointToScreenshotPoint as mapDesktopPointToScreenshot, mapDesktopRectToScreenshotRect as mapDesktopRectToScreenshot, mapDipPointToScreenshotPoint as mapDipToScreenshot, mapScreenshotToDipPoint as mapScreenshotToDip } from './screenshot-coordinates';
import {
  describeScreenshotMonitorContext,
  getDisplayRegionLabelFromScreenshotPoint,
} from './screenshot-monitor-context';
import { calculateScreenScaleState, resolveScreenPointFromState, updateScreenScaleState } from './screen-scale-state';
import { getForegroundUIElements } from './ui-elements';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentCoordinateApi } from './service-coordinate-api';
import type { DesktopAgentServiceConstructor } from './service-types';

export type { DesktopAgentCoordinateApi } from './service-coordinate-api';

export function attachDesktopAgentCoordinates(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    dipToScreenPoint: (point) => convertDipToScreenPoint(point),
    mapScreenshotToDipPoint(x, y, layout = null) {
      return mapScreenshotToDip(x, y, layout ?? this.lastScreenshotLayout);
    },
    mapDipPointToScreenshotPoint(x, y, layout = null) {
      return mapDipToScreenshot(x, y, layout ?? this.lastScreenshotLayout);
    },
    mapDesktopPointToScreenshotPoint(x, y) {
      return mapDesktopPointToScreenshot(x, y, this.lastScreenshotLayout);
    },
    mapDesktopRectToScreenshotRect(rect) {
      return mapDesktopRectToScreenshot(rect, this.lastScreenshotLayout);
    },
    getUIElements: () => getForegroundUIElements(),
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
      return getDisplayRegionLabelFromScreenshotPoint(layout ?? this.lastScreenshotLayout, x, y);
    },
    describeScreenshotMonitorContext(layout = null) {
      return describeScreenshotMonitorContext(layout ?? this.lastScreenshotLayout, this.getVirtualDesktopBounds());
    },
    resolveScreenPoint(x, y) {
      return resolveScreenPointFromState({
        x,
        y,
        screenScale: this.screenScale,
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
