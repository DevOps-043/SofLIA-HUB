import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopRegister } from './authorized-registration';
export function registerDesktopAgentObservationHandlers(service: DesktopAgentService, register: DesktopRegister) {
  let stopCurrent: (() => void) | undefined;
  register('start-observation', async (context, objective, rules) => {
    stopCurrent?.();
    let finish!: () => void; const stopped = new Promise<void>(resolve => { finish = resolve; });
    const stop = () => { context.signal.removeEventListener('abort', stop); if (stopCurrent === stop) { stopCurrent = undefined; service.stopObservation(); } finish(); };
    stopCurrent = stop; context.signal.addEventListener('abort', stop, { once: true });
    try {
      context.assert(); await service.startObservation(objective, rules, context.signal); context.assert(); context.retain(stopped);
      return { success: true };
    } catch (error) { stop(); throw error; }
  }, { effect: true });
  register('stop-observation', () => { if (stopCurrent) stopCurrent(); else service.stopObservation(); return { success: true }; }, { control: true });
  return () => { stopCurrent?.(); };
}
