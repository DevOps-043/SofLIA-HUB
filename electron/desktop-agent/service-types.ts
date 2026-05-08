import type { DesktopAgentService } from '../desktop-agent-service';

export type DesktopAgentServiceConstructor = abstract new (...args: any[]) => DesktopAgentService;

export type CompositeScreenshotResult = {
  base64: string;
  layout: import('./types').ScreenshotLayout;
  actualWidth: number;
  actualHeight: number;
};
