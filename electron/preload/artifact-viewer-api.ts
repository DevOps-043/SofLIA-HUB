import type { ArtifactViewerBridge } from '../../src/shared/artifact-viewer';
import type { PreloadBridge, SafeIpc } from './types';
export function exposeArtifactViewerApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const api: ArtifactViewerBridge = {
    preview: reference => ipc.safeInvoke('artifact-viewer:preview', reference),
    pick: () => ipc.safeInvoke('artifact-viewer:pick'),
    openExternal: reference => ipc.safeInvoke('artifact-viewer:open-external', reference),
    saveCopy: reference => ipc.safeInvoke('artifact-viewer:save-copy', reference),
  };
  bridge.exposeInMainWorld('artifactViewer', api);
}
