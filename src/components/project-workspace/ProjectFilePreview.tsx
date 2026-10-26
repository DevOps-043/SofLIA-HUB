import { lazy, Suspense, useEffect, useState } from 'react';
import { projectHubApi } from '../../services/project-hub-api';
import type { ProjectFilePreview as Preview } from '../../shared/project-creation';
import { ProjectDialog } from './ProjectDialog';
import '../artifacts/artifact-viewer.css';
const PdfPreview = lazy(() => import('../artifacts/PdfPreview').then(module => ({ default: module.PdfPreview })));
function decodeText(base64: string) {
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); }
}

export function ProjectFilePreview({ workspaceId, projectId, fileId, name, onClose }: { workspaceId: string; projectId: string; fileId: string; name: string; onClose(): void }) {
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    void projectHubApi.previewLocationFile({ workspaceId, projectId, fileId }).then(result => {
      if (!live) return;
      if (result.success && result.data) setPreview(result.data); else setError(result.error || 'Este archivo no tiene vista previa disponible.');
    }).catch(() => { if (live) setError('No se pudo abrir la vista previa.'); });
    return () => { live = false; };
  }, [workspaceId, projectId, fileId]);
  return <ProjectDialog title={name} onClose={onClose}>
    {error ? <p role="alert" className="project-resource-notice">{error}</p> : !preview ? <p role="status">Cargando vista previa…</p> : preview.mimeType === 'application/pdf' ? <Suspense fallback={<p>Cargando PDF…</p>}><PdfPreview base64={preview.base64} /></Suspense> : preview.mimeType.startsWith('image/') ? <img className="project-file-image" src={`data:${preview.mimeType};base64,${preview.base64}`} alt={preview.name} /> : <pre className="project-file-text">{decodeText(preview.base64)}</pre>}
  </ProjectDialog>;
}
