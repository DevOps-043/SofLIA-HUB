import { contextBridge, ipcRenderer } from 'electron';
import { exposeLocalVoiceApi } from '../../../electron/preload/local-voice-api';
import { exposeOrbApi } from '../../../electron/preload/orb-api';
import { createSafeIpc } from '../../../electron/preload/safe-ipc';
const ipc = createSafeIpc(ipcRenderer);
exposeLocalVoiceApi(contextBridge, ipc);
exposeOrbApi(contextBridge, ipc);
