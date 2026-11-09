import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopRegister } from './authorized-registration';
import { desktopKeys } from '../../src/shared/desktop-keys';
export function registerDesktopAgentPrimitiveHandlers(service: DesktopAgentService, register: DesktopRegister) {
  register('click', async (_ctx, x, y) => { await service.mouseClick(x, y); return { success: true }; }, { effect: true });
  register('double-click', async (_ctx, x, y) => { await service.mouseDoubleClick(x, y); return { success: true }; }, { effect: true });
  register('right-click', async (_ctx, x, y) => { await service.mouseRightClick(x, y); return { success: true }; }, { effect: true });
  register('drag', async (_ctx, x1, y1, x2, y2) => { await service.mouseDrag(x1, y1, x2, y2); return { success: true }; }, { effect: true });
  register('type', async (_ctx, text) => { await service.keyboardType(text); return { success: true }; }, { effect: true });
  register('key', async (_ctx, key) => { desktopKeys(key); await service.keyboardKey(key); return { success: true }; }, { effect: true });
  register('scroll', async (_ctx, direction, amount) => { await service.mouseScroll(direction, amount); return { success: true }; }, { effect: true });
}
