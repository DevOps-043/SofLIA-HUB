import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopRegister } from './authorized-registration';
export function registerDesktopAgentWindowHandlers(service: DesktopAgentService, register: DesktopRegister) {
  register('focus-window', async (_ctx, title) => ({ success: true, found: await service.focusWindow(title) }), { effect: true });
  register('list-windows', async () => ({ success: true, windows: await service.listWindows() }));
  register('take-screenshot', async (_ctx, fullRes) => ({ success: true, data: await service.takeScreenshot(fullRes) }));
}
