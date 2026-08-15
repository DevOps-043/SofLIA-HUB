import { app } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registerAiGroundingHandler } from '../ai-grounding-handler';
import { extractProtocolArg, parseAppProtocolCommand } from '../app-protocol';
import { logBootstrapError, runOptionalStep } from './bootstrap-steps';
import { configureMainProcessEnvironment } from './environment';
import { loadMainServiceModules } from './service-modules';
import { createMainServices } from './service-factory';
import { createRuntimeState } from './runtime-state';
import { createWindowControls } from './window-controls';
import { createWhatsAppAgentInitializer } from './whatsapp-agent-init';
import { registerAppLifecycle } from './app-lifecycle';
import { registerMainServiceIpcHandlers } from './service-ipc';
import { registerServiceEvents } from './service-events';
import { registerSummaryIpcHandlers } from './summary-ipc';
import { initializeMainServices, registerPlatformHandlers } from './startup';
import { markBoot } from './boot-timeline';
import { registerAuthStateHandlers } from '../auth-state-handlers';
import { restoreHubSession } from './hub-session';
import { registerWhatsAppAuthGate } from './whatsapp-auth-gate';

/**
 * Registra el esquema `soflia://` en el sistema operativo.
 *
 * En una aplicacion empaquetada basta con el nombre: el ejecutable es la propia
 * aplicacion. En desarrollo NO, porque el ejecutable es `electron.exe` y espera
 * la ruta del script como primer argumento. Si se registra sin ella, el sistema
 * lanza `electron.exe soflia://...` y Electron interpreta la URL como la ruta de
 * la aplicacion, fallando con "Unable to find Electron app at".
 */
function registerAppProtocolClient(): void {
  // `defaultApp` es true cuando Electron corre un script en vez de un binario
  // empaquetado, que es exactamente el caso de desarrollo.
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('soflia', process.execPath, [path.resolve(process.argv[1])]);
    return;
  }

  app.setAsDefaultProtocolClient('soflia');
}

export async function runBootstrap(): Promise<void> {
  const modules = await loadMainServiceModules();
  const runtimeDirname = path.dirname(fileURLToPath(import.meta.url));
  const env = configureMainProcessEnvironment(runtimeDirname);
  const protocolCommand = parseAppProtocolCommand(extractProtocolArg(process.argv));
  const services = createMainServices(modules);
  const state = createRuntimeState(protocolCommand);
  const controls = createWindowControls({ env, modules, runtimeDirname, services, state });
  const initWhatsAppAgent = createWhatsAppAgentInitializer({ modules, services, state });

  services.workspaceAutomationService.setApiKey(state.currentGeminiApiKey);
  services.proactiveService.setCalendarService(services.calendarService);
  services.proactiveService.setWhatsAppService(services.waService);
  services.meetingPassiveDetectionService.setWhatsAppService(services.waService);

  registerServiceEvents({ modules, services, state, controls });
  registerSummaryIpcHandlers({ modules, services, state });
  registerAiGroundingHandler();
  registerMainServiceIpcHandlers({ services, state, initWhatsAppAgent });
  registerAppLifecycle({ services, state, controls });

  await app.whenReady();
  markBoot('app:ready');
  console.log('[BOOT] App ready. Initializing subsystems...');
  registerAppProtocolClient();

  modules.MenuManager.setup();
  controls.registerOrbShortcut();
  // Debe registrarse antes de crear la ventana: el renderer publica su estado de
  // sesion apenas monta y el gate del main depende de ese canal.
  registerAuthStateHandlers();
  // La autoconexion de WhatsApp del arranque queda denegada por el gate; se
  // reintenta al iniciar sesion y se desconecta al cerrarla.
  registerWhatsAppAuthGate({ waService: services.waService, initWhatsAppAgent });
  registerPlatformHandlers({ modules, services, state, controls });

  // Ventana temprana: crear la ventana antes de la cadena de servicios no
  // esenciales para el primer pintado, de modo que la UI aparezca sin esperar a
  // todo el arranque. Los handlers IPC ya estan registrados arriba, asi que el
  // renderer no encuentra canales ausentes. createOrFocusMainWindow es
  // idempotente: la creacion posterior dentro de initializeMainServices no
  // duplica la ventana. La ventana se revela en `ready-to-show`.
  // Rollback: SOFLIA_STARTUP_LEGACY_ORDER=1 omite la creacion temprana y conserva
  // el orden anterior (ventana creada al final de la cadena de servicios).
  if (process.env.SOFLIA_STARTUP_LEGACY_ORDER !== '1') {
    markBoot('ventana-temprana:inicio');
    controls.createWindow(state.shouldShowInitialWindow);
    markBoot('ventana-temprana:fin');
  }

  // La sesion guardada se restaura ANTES de los servicios: el planificador
  // levanta sus cron durante su init, y sin identidad los cargaria como cliente
  // anonimo, sin encontrar las reglas del usuario. Es tambien lo que permite que
  // WhatsApp y Telegram funcionen sin ninguna ventana abierta.
  markBoot('sesion-hub:restaurar:inicio');
  const sesionHub = await restoreHubSession().catch((error) => {
    logBootstrapError('restoreHubSession', error);
    return 'no-disponible' as const;
  });
  console.log(`[BOOT] Sesion del Hub: ${sesionHub}`);
  markBoot('sesion-hub:restaurar:fin');

  markBoot('servicios:init:inicio');
  await initializeMainServices({
    modules,
    services,
    state,
    controls,
    initWhatsAppAgent,
    runOptionalStep,
    logBootstrapError,
  });
  markBoot('servicios:init:fin');
}
