import type { UIElement } from '../desktop-agent-types';
import type { ScreenshotLayout } from './types';

export interface DesktopAgentCoordinateApi {
  dipToScreenPoint(point: { x: number; y: number }): { x: number; y: number };
  mapScreenshotToDipPoint(x: number, y: number, layout?: ScreenshotLayout | null): { x: number; y: number } | null;
  mapDipPointToScreenshotPoint(x: number, y: number, layout?: ScreenshotLayout | null): { x: number; y: number } | null;
  mapDesktopPointToScreenshotPoint(x: number, y: number): { x: number; y: number } | null;
  mapDesktopRectToScreenshotRect(rect: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } | null;
  getUIElements(): Promise<UIElement[]>;
  calculateScreenScale(): void;
  updateScreenScale(actualWidth: number, actualHeight: number): void;
  getDisplayRegionLabelFromScreenshotPoint(x: number, y: number, layout?: ScreenshotLayout | null): string | null;
  describeScreenshotMonitorContext(layout?: ScreenshotLayout | null): string;
  resolveScreenPoint(x: number, y: number): { x: number; y: number; dipX?: number; dipY?: number; source: 'layout' | 'scale'; regionLabel?: string | null };
  scale(x: number, y: number): { x: number; y: number };
}
