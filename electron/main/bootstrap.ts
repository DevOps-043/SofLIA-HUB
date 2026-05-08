import { app } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractProtocolArg, parseAppProtocolCommand } from '../app-protocol';
import { logBootstrapError, runOptionalStep } from './bootstrap-steps';
import { configureMainProcessEnvironment } from './environment';
import { loadMainServiceModules } from './service-modules';
import { createMainServices } from './service-factory';
import { createRuntimeState } from './runtime-state';
import { createWindowControls } from './window-controls';
import { createWhatsAppAgentInitializer } from './whatsapp-agent-init';
import { registerAppLifecycle } from './app-lifecycle';
import { registerFlowIpcHandlers } from './flow-ipc';
import { registerMainServiceIpcHandlers } from './service-ipc';
import { registerServiceEvents } from './service-events';
import { registerSummaryIpcHandlers } from './summary-ipc';
import { initializeMainServices, registerPlatformHandlers } from './startup';

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
  registerFlowIpcHandlers({ services, state, controls });
  registerMainServiceIpcHandlers({ services, state, initWhatsAppAgent });
  registerAppLifecycle({ services, state, controls });

  await app.whenReady();
  console.log('[BOOT] App ready. Initializing subsystems...');
  app.setAsDefaultProtocolClient('soflia');

  modules.MenuManager.setup();
  controls.registerFlowShortcut();
  registerPlatformHandlers({ modules, services, state });
  await initializeMainServices({
    modules,
    services,
    state,
    controls,
    initWhatsAppAgent,
    runOptionalStep,
    logBootstrapError,
  });
}
