import { contextBridge, ipcRenderer } from 'electron';
import { exposeProjectHubApi } from '../../../electron/preload/project-hub-api';
import { createSafeIpc } from '../../../electron/preload/safe-ipc';

exposeProjectHubApi(contextBridge, createSafeIpc(ipcRenderer));
