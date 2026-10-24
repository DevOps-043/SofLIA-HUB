import { contextBridge, ipcRenderer } from 'electron';
import { exposePythonToolsApi } from '../../../electron/preload/python-tools-api';
import { createSafeIpc } from '../../../electron/preload/safe-ipc';
exposePythonToolsApi(contextBridge, createSafeIpc(ipcRenderer));
