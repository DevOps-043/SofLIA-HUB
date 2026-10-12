import { createContext, useContext } from 'react';
import type { ArtifactReference, ViewerFile } from '../../shared/artifact-viewer';
export interface ArtifactViewerState {
  files: ViewerFile[];
  selected: ArtifactReference | null;
  open(files: ViewerFile[], selected: ArtifactReference): void;
  select(reference: ArtifactReference): void;
  pick(): Promise<void>;
  close(): void;
  error: string;
}
export const ArtifactViewerContext = createContext<ArtifactViewerState | null>(null);
export const useArtifactViewer = () => useContext(ArtifactViewerContext);
export function referenceKey(reference: ArtifactReference): string {
  return reference.kind === 'team' ? reference.jobId + ':' + reference.artifactId : reference.id;
}
