import { useCallback, useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import type { ArtifactReference, ViewerFile } from '../../shared/artifact-viewer';
import { VIEWER_LIMITS } from '../../shared/artifact-viewer';
import { artifactViewerService } from '../../services/artifact-viewer';
import { ArtifactViewerContext } from './artifact-viewer-context';

export function ArtifactViewerProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<ViewerFile[]>([]);
  const [selected, setSelected] = useState<ArtifactReference | null>(null);
  const [error, setError] = useState('');
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; }, []);
  const open = useCallback((next: ViewerFile[], reference: ArtifactReference) => {
    revision.current++;
    setError(''); setFiles(next.slice(0, VIEWER_LIMITS.tabs)); setSelected(reference);
  }, []);
  const close = useCallback(() => { revision.current++; setSelected(null); setFiles([]); setError(''); }, []);
  const pick = useCallback(async () => {
    const version = ++revision.current;
    setError('');
    try {
      const file = await artifactViewerService.pick();
      if (file && version === revision.current) open([file], file.reference);
    } catch (failure) {
      if (version === revision.current) setError(failure instanceof Error ? failure.message : 'No pude seleccionar el archivo.');
    }
  }, [open]);
  const value = useMemo(() => ({ files, selected, open, select: setSelected, pick, close, error }), [files, selected, open, pick, close, error]);
  return <ArtifactViewerContext.Provider value={value}>{children}</ArtifactViewerContext.Provider>;
}
