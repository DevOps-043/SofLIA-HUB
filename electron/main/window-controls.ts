import { Notification } from 'electron';
import path from 'node:path';
import { createOrbWindowController } from './orb-window-controller';
import { createMainTray } from './tray-controller';
import { createOrFocusMainWindow } from './window-controller';
import type { AuthCallbackPayload, MeetingTriggerPayload } from '../app-protocol';
import type { MainRuntimeState } from './runtime-state';

export function createWindowControls(input: {
  env: { VITE_DEV_SERVER_URL?: string; RENDERER_DIST: string };
  modules: any;
  runtimeDirname: string;
  services: any;
  state: MainRuntimeState;
}) {
  const { env, runtimeDirname, services, state } = input;
  const orbController = createOrbWindowController({
    preloadPath: path.join(runtimeDirname, 'preload.js'),
    rendererDist: env.RENDERER_DIST,
    devServerUrl: env.VITE_DEV_SERVER_URL,
    getWindow: () => state.orbWin,
    setWindow: (nextOrbWin) => { state.orbWin = nextOrbWin; },
    setPendingWake: (value) => { state.pendingOrbWake = value; },
  });

  const controls = {
    createOrbWindow: orbController.createOrbWindow,
    registerOrbShortcut: orbController.registerOrbShortcut,
    orbAnnouncements: orbController.announcements,
    createWindow(showWindow = !state.startInBackground): void {
      state.win = createOrFocusMainWindow({
        currentWindow: state.win,
        showWindow,
        isQuitting: () => state.isQuitting,
        preloadPath: path.join(runtimeDirname, 'preload.js'),
        iconPath: path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico'),
        rendererUrl: env.VITE_DEV_SERVER_URL,
        rendererDist: env.RENDERER_DIST,
        onClosed: () => {
          services.integratedBrowserService.detachWindow();
          state.win = null;
        },
      });
      services.integratedBrowserService.attachWindow(state.win);
    },
    createTray(): void {
      createMainTray({
        currentTray: () => state.tray,
        setTray: (nextTray) => { state.tray = nextTray; },
        getWindow: () => state.win,
        createWindow: controls.createWindow,
        createOrbWindow: orbController.createOrbWindow,
        setQuitting: (value) => { state.isQuitting = value; },
      });
    },
    routeShareLinkToRenderer(shareLink: string): void {
      state.pendingShareLink = shareLink;
      if (!state.win) {
        controls.createWindow(true);
        return;
      }
      if (state.win.isMinimized()) state.win.restore();
      if (!state.win.isVisible()) state.win.show();
      state.win.focus();
      state.win.webContents.send('app:share-link', shareLink);
    },
    /**
     * Entrega el retorno del inicio federado al renderer, que es quien tiene el
     * verificador y decide si el `state` corresponde a una solicitud suya.
     *
     * Se retiene siempre en el estado: si la ventana aun no monto, el renderer
     * lo recoge al suscribirse en vez de perderlo.
     */
    routeAuthCallbackToRenderer(payload: AuthCallbackPayload): void {
      state.pendingAuthCallback = payload;
      if (!state.win) {
        controls.createWindow(true);
        return;
      }
      if (state.win.isMinimized()) state.win.restore();
      if (!state.win.isVisible()) state.win.show();
      state.win.focus();
      state.win.webContents.send('app:auth-callback', payload);
    },
    routeMeetingTriggerToRenderer(payload: MeetingTriggerPayload): void {
      state.pendingMeetingTrigger = payload;
      if (!state.win) {
        controls.createWindow(false);
        return;
      }
      state.win.webContents.send('app:meeting-trigger', payload);
      if (!Notification.isSupported()) return;
      const title = payload.meetingTitle || payload.meetingCode || 'Reunion detectada';
      const body = payload.action === 'stop'
        ? `${title}: la extension marco el cierre de la reunion.`
        : `${title}: la extension activo el seguimiento de trazabilidad.`;
      new Notification({ title: 'Workflow de reuniones', body }).show();
    },
  };

  return controls;
}
