import type { ArtifactReference, ArtifactViewerBridge, ViewerReply } from '../shared/artifact-viewer';
declare global { interface Window { artifactViewer?: ArtifactViewerBridge } }
function bridge(): ArtifactViewerBridge {
  if (!window.artifactViewer) throw new Error('Reinicia Soflia Hub para activar el visor de archivos.');
  return window.artifactViewer;
}
async function result<T>(reply: Promise<ViewerReply<T>>): Promise<T> {
  const value = await reply;
  if (!value.success) throw new Error(value.error);
  return value.data;
}
export const artifactViewerService = {
  preview: (reference: ArtifactReference) => result(bridge().preview(reference)),
  pick: () => result(bridge().pick()),
  openExternal: (reference: ArtifactReference) => result(bridge().openExternal(reference)),
  saveCopy: (reference: ArtifactReference) => result(bridge().saveCopy(reference)),
};
