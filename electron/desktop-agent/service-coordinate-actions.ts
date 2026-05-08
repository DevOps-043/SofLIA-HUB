import {
  assertActionTargetsVisibleContent as assertVisibleActionTargets,
  formatActionCoordinateResolution,
} from './action-coordinate-resolution';
import { refineDesktopActionCoordinates } from './action-coordinate-refinement';
import type { DesktopActionPayload, UIElement } from '../desktop-agent-types';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentServiceConstructor } from './service-types';

export interface DesktopAgentCoordinateActionApi {
  refineActionCoordinates(action: DesktopActionPayload): DesktopActionPayload;
  logActionCoordinateResolution(action: DesktopActionPayload): void;
  assertActionTargetsVisibleContent(action: DesktopActionPayload): void;
}

export function attachDesktopAgentCoordinateActions(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    refineActionCoordinates(action) {
      return refineDesktopActionCoordinates({
        action,
        layout: this.lastScreenshotLayout,
        currentUIElements: this.currentUIElements,
        mapDesktopRectToScreenshotRect: (rect: UIElement['boundingRect']) => this.mapDesktopRectToScreenshotRect(rect),
        log: (message: string) => { console.log(message); },
      });
    },
    logActionCoordinateResolution(action) {
      const message = formatActionCoordinateResolution(action, (x, y) => this.resolveScreenPoint(x, y));
      if (message) console.log(message);
    },
    assertActionTargetsVisibleContent(action) {
      assertVisibleActionTargets(action, (x, y) => this.resolveScreenPoint(x, y));
    },
  } satisfies DesktopAgentCoordinateActionApi & ThisType<DesktopAgentService>);
}
