import { app, BrowserWindow, dialog, globalShortcut } from 'electron';
import { extractProtocolArg, parseAppProtocolCommand, type AuthCallbackPayload, type MeetingTriggerPayload } from '../app-protocol';
import type { IntegratedBrowserService } from '../integrated-browser';
import type { UpdaterService } from '../updater-service';
import type { MainRuntimeState } from './runtime-state';
import { ShutdownGuard, type ShutdownFailure } from './shutdown-guard';

interface LifecycleControls {
  createWindow: (show: boolean) => void;
  routeShareLinkToRenderer: (link: string) => void;
  routeAuthCallbackToRenderer: (payload: AuthCallbackPayload) => void;
  routeMeetingTriggerToRenderer: (payload: MeetingTriggerPayload) => void;
}

interface LifecycleServices {
  integratedBrowserService: Pick<IntegratedBrowserService, 'flushSessionForShutdown' | 'flushClosedProfileForShutdown' | 'commitShutdown' | 'resumeAfterShutdown'>;
  updaterService: Pick<UpdaterService, 'setInstallGuard' | 'stop'>;
  pathMemoryService: { stop: () => void };
  clipboardAssistant: { stop: () => void | Promise<void> };
  meetingPassiveDetectionService: { stopPolling: () => void };
}

export function registerAppLifecycle(input: { services: LifecycleServices; state: MainRuntimeState; controls: LifecycleControls }): void {
  const { services, state, controls } = input;
  const shutdown = new ShutdownGuard({
    prepare: () => services.integratedBrowserService.flushSessionForShutdown(),
    approve: () => {
      services.integratedBrowserService.commitShutdown();
      state.isQuitting = true;
    },
    resume: () => {
      state.isQuitting = false;
      services.integratedBrowserService.resumeAfterShutdown();
    },
    decide: async (failure: ShutdownFailure) => {
      console.warn(`[Cierre] Sesión no confirmada: ${failure === 'timeout' ? 'tiempo agotado' : 'fallo de guardado'}.`);
      const options = {
        type: 'warning' as const,
        title: 'No se pudo guardar la sesión del navegador',
        message: failure === 'timeout' ? 'El guardado está tardando más de lo esperado.' : 'No se pudo confirmar el último guardado.',
        detail: 'Puedes reintentar o cancelar la salida. Si sales sin guardar, podrían perderse los últimos cambios de pestañas. Si existe un respaldo previo, se conservará.',
        buttons: ['Reintentar', 'Cancelar salida', 'Salir sin guardar'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      };
      const parent = state.win;
      const { response } = parent && !parent.isDestroyed()
        ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);
      return response === 0 ? 'retry' : response === 2 ? 'proceed' : 'cancel';
    },
  });
  services.updaterService.setInstallGuard((install) => shutdown.request('update', install), () => shutdown.cancel());

  let finalizing = false;
  let finalQuitApproved = false;
  const cleanup = new ShutdownGuard({
    prepare: () => services.integratedBrowserService.flushClosedProfileForShutdown(),
    approve: () => { finalQuitApproved = true; },
    resume: () => {
      finalizing = false;
      finalQuitApproved = false;
      shutdown.cancel();
      controls.createWindow(true);
    },
    decide: async (failure) => {
      const { response } = await dialog.showMessageBox({
        type: 'warning', title: 'Limpieza del perfil temporal',
        message: failure === 'timeout' ? 'La limpieza está tardando más de lo esperado.' : 'No se pudo completar la limpieza.',
        detail: 'Puedes reintentar o volver a la aplicación. Si sales ahora, podrían quedar datos temporales en este equipo.',
        buttons: ['Reintentar', 'Volver a la aplicación', 'Salir sin completar la limpieza'],
        defaultId: 1, cancelId: 1, noLink: true,
      });
      return response === 0 ? 'retry' : response === 2 ? 'proceed' : 'cancel';
    },
  });

  function routeProtocolCommand(rawUrl: string | null): boolean {
    const protocolCommand = parseAppProtocolCommand(rawUrl);
    if (protocolCommand?.type === 'share-link') {
      controls.routeShareLinkToRenderer(protocolCommand.shareLink);
      return true;
    }
    if (protocolCommand?.type === 'auth-callback') {
      controls.routeAuthCallbackToRenderer(protocolCommand.payload);
      return true;
    }
    if (protocolCommand?.type === 'meeting-trigger') {
      controls.routeMeetingTriggerToRenderer(protocolCommand.payload);
      return true;
    }
    return false;
  }

  app.on('second-instance', (_event, commandLine) => {
    if (finalizing) return;
    if (routeProtocolCommand(extractProtocolArg(commandLine))) return;
    focusMainWindow(state, controls);
  });

  // macOS no relanza el proceso con el argumento: entrega el deep link por este
  // evento. Sin el, el retorno del inicio federado no llega nunca en esa
  // plataforma.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (finalizing) return;
    if (routeProtocolCommand(url)) return;
    focusMainWindow(state, controls);
  });

  app.on('before-quit', (event) => {
    if (finalQuitApproved) return;
    if (finalizing) { event.preventDefault(); return; }
    if (shutdown.consumeQuitApproval()) return;
    event.preventDefault();
    // El tray puede haber marcado isQuitting. Durante la espera, cerrar la
    // ventana vuelve a ocultarla; aún no está autorizado destruir sus vistas.
    state.isQuitting = false;
    void shutdown.request('quit', () => app.quit());
  });

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-prevent-unload', () => { if (!finalizing) shutdown.cancel(); });
  });

  let stopped = false;
  app.on('will-quit', (event) => {
    if (stopped) return;
    // Aquí ya terminaron close/beforeunload y detachWindow inició la purga.
    // Electron no espera promesas de listeners: detener la salida y reanudarla.
    if (!finalQuitApproved) {
      event.preventDefault();
      finalizing = true;
      state.isQuitting = true;
      void cleanup.request('quit', () => app.quit());
      return;
    }
    stopped = true;
    shutdown.commit();
    cleanup.commit();
    console.log('[Inicio] Cierre confirmado.');
    state.isQuitting = true;
    stopAtShutdown('atajos', () => globalShortcut.unregisterAll());
    stopAtShutdown('memoria de rutas', () => services.pathMemoryService.stop());
    stopAtShutdown('portapapeles', () => services.clipboardAssistant.stop());
    stopAtShutdown('detección de reuniones', () => services.meetingPassiveDetectionService.stopPolling());
    stopAtShutdown('actualizaciones', () => services.updaterService.stop());
    stopAtShutdown('runtime Python', () => import('../python-runtime-service').then((m) => m.pythonRuntimeService.stop()));
    stopAtShutdown('herramientas Python', () => import('../python-tools-service').then((m) => m.pythonToolsService.stop()));
    if (state.tray) {
      state.tray.destroy();
      state.tray = null;
    }
  });

  app.on('window-all-closed', () => {
    console.log('[BOOT] window-all-closed');
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (finalizing) return;
    if (BrowserWindow.getAllWindows().length === 0) {
      controls.createWindow(true);
      return;
    }
    state.win?.show();
    state.win?.focus();
  });
  app.on('browser-window-created', () => console.log('[BOOT] Browser window created'));
  app.on('render-process-gone', (_event, _webContents, details) => {
    console.error(`[BOOT] render-process-gone: ${details.reason} (exitCode=${details.exitCode})`);
  });
  app.on('child-process-gone', (_event, details) => {
    console.error(`[BOOT] child-process-gone: ${details.type} (${details.reason})`);
  });
}

function focusMainWindow(state: MainRuntimeState, controls: LifecycleControls): void {
  if (!state.win) {
    controls.createWindow(true);
    return;
  }
  if (state.win.isMinimized()) state.win.restore();
  if (!state.win.isVisible()) state.win.show();
  state.win.focus();
}

function stopAtShutdown(name: string, stop: () => void | Promise<void>): void {
  try {
    void Promise.resolve(stop()).catch(() => console.warn(`[Cierre] No se pudo detener: ${name}.`));
  } catch { console.warn(`[Cierre] No se pudo detener: ${name}.`); }
}
