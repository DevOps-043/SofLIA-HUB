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
import { registerWhatsAppAuthGate } from './whatsapp-auth-gate';

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
  app.setAsDefaultProtocolClient('soflia');

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
