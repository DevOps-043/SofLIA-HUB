import { app, screen, type BrowserWindow } from 'electron';
import { getAuthState } from '../main/auth-state';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { IntegratedBrowserService } from '../integrated-browser';
import { physicalRectToDipRect, screenToDipPoint } from '../desktop-agent/screenshot-coordinates';
import { locateServiceElement } from '../desktop-agent/service-action-runtime';
import { OrbGuidanceService } from './service';
import { GuidanceSurfaces, type OrbSurfaceOptions } from './surfaces';
import { registerGuidanceHandlers } from './handlers';

export function initializeOrbGuidance(options: OrbSurfaceOptions & {
  getMain: () => BrowserWindow | null;
  desktop: DesktopAgentService;
  browser: IntegratedBrowserService;
}): OrbGuidanceService {
  const surfaces = new GuidanceSurfaces(options);
  let observation: Promise<unknown> = Promise.resolve();
  const service = new OrbGuidanceService({
    surfaces,
    authorized: () => getAuthState().authenticated,
    locate: text => {
      const assertCurrent = service.createGuard();
      const pending = observation.then(async () => {
        assertCurrent();
        // Una captura actual impide reutilizar el OCR de un paso anterior.
        const capture = await options.desktop.captureCompositeScreenshot(
          options.desktop.config.screenshotWidth, options.desktop.config.screenshotHeight, { purpose: 'verification' },
        );
        assertCurrent();
        const { elemento } = await locateServiceElement(options.desktop, text, undefined, { capture, ignoreBlocked: true });
        assertCurrent();
        return elemento ? { point: screenToDipPoint(elemento.centroFisico), ...(elemento.bboxFisico ? { rect: physicalRectToDipRect(elemento.bboxFisico) } : {}) } : null;
      });
      observation = pending.catch(() => undefined);
      return pending;
    },
  });
  options.desktop.visualGuidance = service;
  options.browser.visualGuidance = service;
  const publish = () => {
    const state = service.getState();
    for (const window of [options.getMain(), options.getOrb()]) {
      if (window && !window.isDestroyed()) window.webContents.send('orb:guidance-state', state);
    }
  };
  service.on('state', publish);
  const clear = () => service.clear();
  const interrupt = () => { options.desktop.abortAll(); service.clear(); };
  const disposeHandlers = registerGuidanceHandlers({ service, getWindows: () => [options.getMain(), options.getOrb()],
    abortComputer: () => options.desktop.abortAll(), computerRunning: () => options.desktop.isRunning(),
  });
  for (const event of ['task-completed', 'task-failed', 'task-budget-exhausted']) options.desktop.on(event, clear);
  let disposed = false;
  void app.whenReady().then(() => {
    if (disposed) return;
    screen.on('display-removed', interrupt);
    screen.on('display-metrics-changed', interrupt);
  });
  app.once('before-quit', () => {
    disposed = true;
    disposeHandlers(); service.clear(); surfaces.dispose();
    screen.removeListener('display-removed', interrupt); screen.removeListener('display-metrics-changed', interrupt);
    for (const event of ['task-completed', 'task-failed', 'task-budget-exhausted']) options.desktop.removeListener(event, clear);
  });
  return service;
}
