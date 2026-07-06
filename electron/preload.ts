import { contextBridge, ipcRenderer } from 'electron';
import { exposeCalendarApi } from './preload/calendar-api';
import { exposeComputerApis } from './preload/computer-apis';
import {
  exposeCommunicationHubApi,
  exposeMonitoringApi,
  exposeWhatsAppApi,
} from './preload/communication-apis';
import { exposeCoreApis } from './preload/core-apis';
import { exposeDesktopApi } from './preload/desktop-apis';
import { exposeGoogleApis } from './preload/google-apis';
import { exposeRemoteApis } from './preload/remote-apis';
import { runtimeConfig } from './preload/runtime-config';
import { createSafeIpc } from './preload/safe-ipc';
import {
  assertContextIsolation,
  injectCSP,
} from './preload/security';
import { exposeUtilityApis } from './preload/utility-apis';
import { exposeWorkflowApis } from './preload/workflow-apis';

assertContextIsolation();
injectCSP();

const safeIpc = createSafeIpc(ipcRenderer);

exposeCoreApis(contextBridge, ipcRenderer, safeIpc, runtimeConfig);
exposeComputerApis(contextBridge, safeIpc);
exposeRemoteApis(contextBridge, safeIpc);
exposeWorkflowApis(contextBridge, safeIpc);
exposeCommunicationHubApi(contextBridge, safeIpc);
exposeWhatsAppApi(contextBridge, safeIpc);
exposeMonitoringApi(contextBridge, safeIpc);
exposeCalendarApi(contextBridge, safeIpc);
exposeGoogleApis(contextBridge, safeIpc);
exposeDesktopApi(contextBridge, safeIpc);
exposeUtilityApis(contextBridge, safeIpc);
