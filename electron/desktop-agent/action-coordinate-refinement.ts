import type { DesktopActionPayload, UIElement } from '../desktop-agent-types';
import type { ScreenshotLayout } from './types';
import { snapPointToStructuredElement, snapPointToVisibleRegion } from './coordinate-snapping';

type Rect = { x: number; y: number; width: number; height: number };

const POINT_ACTIONS = new Set(['click', 'double_click', 'right_click', 'type']);

export function refineDesktopActionCoordinates(params: {
  action: DesktopActionPayload;
  layout: ScreenshotLayout | null;
  currentUIElements: UIElement[];
  mapDesktopRectToScreenshotRect: (rect: Rect) => Rect | null;
  log: (message: string) => void;
}): DesktopActionPayload {
  const { action } = params;
  if (action.action === 'click_element' || action.action === 'type_in_element') return action;
  const dragAction = action.action === 'drag';
  if (!POINT_ACTIONS.has(action.action) && !dragAction) return action;

  let nextAction = action;
  const maybeAdjustPoint = (pointX: number, pointY: number, label: string): { x: number; y: number } => {
    const visiblePoint = snapPointToVisibleRegion(pointX, pointY, params.layout);
    let adjustedX = visiblePoint.x;
    let adjustedY = visiblePoint.y;

    if (visiblePoint.adjusted) {
      params.log(`[DesktopAgent] Ajuste de coordenada ${label}: (${Math.round(pointX)}, ${Math.round(pointY)}) -> (${Math.round(adjustedX)}, ${Math.round(adjustedY)}) para salir del padding.`);
    }

    if (POINT_ACTIONS.has(action.action)) {
      const snappedElement = snapPointToStructuredElement({
        x: adjustedX,
        y: adjustedY,
        elements: params.currentUIElements,
        mapRect: params.mapDesktopRectToScreenshotRect,
      });
      if (snappedElement) {
        adjustedX = snappedElement.x;
        adjustedY = snappedElement.y;
        params.log(
          `[DesktopAgent] Snap semantico ${label}: ${snappedElement.reason === 'inside' ? 'dentro de' : 'cerca de'} ${snappedElement.element.controlType} "${snappedElement.element.name || snappedElement.element.automationId || 'sin nombre'}" -> centro (${Math.round(adjustedX)}, ${Math.round(adjustedY)}).`,
        );
      }
    }
    return { x: adjustedX, y: adjustedY };
  };

  if (action.x !== undefined && action.y !== undefined) {
    const adjusted = maybeAdjustPoint(action.x, action.y, 'principal');
    nextAction = { ...nextAction, x: adjusted.x, y: adjusted.y };
  }
  if (dragAction && action.x2 !== undefined && action.y2 !== undefined) {
    const adjustedEnd = maybeAdjustPoint(action.x2, action.y2, 'destino');
    nextAction = { ...nextAction, x2: adjustedEnd.x, y2: adjustedEnd.y };
  }
  return nextAction;
}
