import { useArtifactViewer } from '../artifacts/artifact-viewer-context';
import { ArtifactViewerPanel } from '../artifacts/ArtifactViewerPanel';
import { ProjectDialog } from '../project-workspace/ProjectDialog';

/** Abrir un resultado no desmonta el chat ni interrumpe su generación. */
export function FloatingArtifactPreview() {
  const viewer = useArtifactViewer();
  if (!viewer?.selected) return null;
  return <ProjectDialog title="Vista previa del archivo" onClose={viewer.close}><div style={{height:'min(64vh, 640px)'}}><ArtifactViewerPanel compact /></div></ProjectDialog>;
}
