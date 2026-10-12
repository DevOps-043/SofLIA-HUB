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
  const service = new OrbGuidanceService({
    surfaces,
    authorized: () => getAuthState().authenticated,
    locate: async text => {
      // Una captura actual impide reutilizar el OCR de un paso anterior.
      options.desktop.lastDecisionCapture = await options.desktop.captureCompositeScreenshot(
        options.desktop.config.screenshotWidth, options.desktop.config.screenshotHeight, { purpose: 'verification' },
      );
      const { elemento } = await locateServiceElement(options.desktop, text);
      return elemento ? { point: screenToDipPoint(elemento.centroFisico), ...(elemento.bboxFisico ? { rect: physicalRectToDipRect(elemento.bboxFisico) } : {}) } : null;
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
  const disposeHandlers = registerGuidanceHandlers({ service, getWindows: () => [options.getMain(), options.getOrb()],
    abortComputer: () => options.desktop.abortAll(), computerRunning: () => options.desktop.isRunning(),
  });
  for (const event of ['task-completed', 'task-failed', 'task-budget-exhausted']) options.desktop.on(event, clear);
  screen.on('display-removed', clear);
  screen.on('display-metrics-changed', clear);
  app.once('before-quit', () => {
    disposeHandlers(); service.clear(); surfaces.dispose();
    screen.removeListener('display-removed', clear); screen.removeListener('display-metrics-changed', clear);
    for (const event of ['task-completed', 'task-failed', 'task-budget-exhausted']) options.desktop.removeListener(event, clear);
  });
  return service;
}
