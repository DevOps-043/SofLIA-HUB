import { useState } from 'react';
import type { BackgroundArtifact } from '../../shared/background-teams';
import { referenceKey, useArtifactViewer } from '../artifacts/artifact-viewer-context';
import { ArtifactFileIcon } from '../artifacts/ArtifactFileIcon';
import { artifactFormat } from '../artifacts/artifact-format';
import { useAgentActivityPanel } from './agent-activity-context';
import { ArrowUpRight } from './activity-icons';
export function TeamFiles({ jobId, files, compact = false }: { jobId: string; files: BackgroundArtifact[]; compact?: boolean }) {
  const [error, setError] = useState('');
  const viewer = useArtifactViewer();
  const activity = useAgentActivityPanel();
  const open = (file: BackgroundArtifact) => {
    setError('');
    if (!viewer) { setError('El visor no está disponible en esta ventana.'); return; }
    viewer.open(files.filter(item => item.verified).map(item => ({ reference: { kind: 'team', jobId, artifactId: item.id }, name: item.name, extension: item.format, bytes: item.bytes })), { kind: 'team', jobId, artifactId: file.id });
    activity?.setOpen(false);
  };
  return <div className="team-files">
    <div className="team-section-heading"><span>Archivos</span><span className="team-count">{files.length}</span></div>
    <ul aria-label="Archivos del trabajo" className={compact ? 'team-file-grid compact' : 'team-file-grid'}>
      {files.map(file => <li key={file.id}><button type="button" disabled={!file.verified} aria-label={'Abrir ' + file.name}
        aria-current={viewer?.selected && referenceKey(viewer.selected) === referenceKey({ kind: 'team', jobId, artifactId: file.id }) ? 'true' : undefined}
        className="team-file-card" onClick={() => void open(file)}>
        <ArtifactFileIcon extension={file.format} />
        <span className="team-file-copy"><strong title={file.name}>{file.name}</strong><span>{artifactFormat(file.format).label} · {Math.max(1, Math.ceil(file.bytes / 1024))} KB{!file.verified ? ' · Preparando' : ''}</span></span>
        <span className="team-file-open"><ArrowUpRight size={15} /></span>
      </button></li>)}
    </ul>
    {[...new Set(files.flatMap(file => file.designNotice ? [file.designNotice] : []))].map(notice => <p key={notice} role="status" className="text-xs text-muted-foreground">{notice}</p>)}
    {error && <p role="alert" className="team-operation-error">{error}</p>}
  </div>;
}

