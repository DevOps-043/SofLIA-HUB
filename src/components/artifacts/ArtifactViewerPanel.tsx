import { useEffect, useRef, useState } from 'react';
import type { ArtifactPreview } from '../../shared/artifact-viewer';
import { artifactViewerService } from '../../services/artifact-viewer';
import { ArtifactContent } from './ArtifactContent';
import { ArtifactFileIcon } from './ArtifactFileIcon';
import { artifactFormat } from './artifact-format';
import { referenceKey, useArtifactViewer } from './artifact-viewer-context';
import { useResizablePanel } from './useResizablePanel';
import { PanelResizeGrip } from '../PanelResizeGrip';
import './artifact-viewer.css';

type Viewer = NonNullable<ReturnType<typeof useArtifactViewer>>;
export function ArtifactViewerPanel({ compact = false }: { compact?: boolean }) {
  const viewer = useArtifactViewer();
  const reference = viewer?.selected;
  const [expanded, setExpanded] = useState(false);
  const { bindPanel, width, resizing, minimum, maximum, handlers } = useResizablePanel({ storageKey: 'soflia:artifact-viewer-width', initialWidth: 620, reserve: 280, enabled: Boolean(reference) && !compact && !expanded });
  if (!reference || !viewer) return null;
  return <section ref={bindPanel} className={`artifact-viewer-panel${expanded ? ' expanded' : ''}${compact ? ' compact' : ''}${resizing ? ' resizing' : ''}`} style={!compact && !expanded ? { width: width } : undefined} aria-label="Visor de archivos">
    {!compact && !expanded && <div role="separator" aria-label="Cambiar ancho del visor" title="Arrastra para ajustar el ancho" aria-orientation="vertical" tabIndex={0} aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={width} className="artifact-resize-handle group" {...handlers}><PanelResizeGrip resizing={resizing} /></div>}
    <LoadedArtifactPanel key={referenceKey(reference)} viewer={viewer} reference={reference} compact={compact} expanded={expanded} onExpand={() => setExpanded(value => !value)} />
  </section>;
}
function LoadedArtifactPanel({ viewer, reference, compact, expanded, onExpand }: { viewer: Viewer; reference: NonNullable<Viewer['selected']>; compact: boolean; expanded: boolean; onExpand: () => void }) {
  const [preview, setPreview] = useState<ArtifactPreview | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const file = viewer.files.find(item => referenceKey(item.reference) === referenceKey(reference));
  const tabs = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = tabs.current;
    if (!navigation) return;
    const revealSelected = () => navigation.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    revealSelected();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(revealSelected) : null;
    observer?.observe(navigation);
    return () => observer?.disconnect();
  }, [reference, viewer.files]);
  useEffect(() => {
    let active = true;
    void artifactViewerService.preview(reference).then(value => { if (active) { setPreview(value); setError(''); } }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'No pude cargar la vista previa.'); });
    return () => { active = false; };
  }, [reference, attempt]);
  const operation = async (action: 'save' | 'external') => {
    setBusy(true); setNotice('');
    try {
      if (action === 'save') { if (await artifactViewerService.saveCopy(reference)) setNotice('Copia guardada.'); }
      else await artifactViewerService.openExternal(reference);
    } catch (failure) { setNotice(failure instanceof Error ? failure.message : 'No pude completar la operación.'); }
    finally { setBusy(false); }
  };
  const canSource = preview && ['markdown', 'text', 'html', 'document'].includes(preview.content.kind);
  return <>
    <header className="artifact-viewer-header">
      <ArtifactFileIcon extension={file?.extension ?? ''} />
      <div className="artifact-title"><h2 title={file?.name}>{file?.name ?? 'Vista previa'}</h2><p>{artifactFormat(file?.extension ?? '').label}{file ? ` · ${Math.max(1, Math.ceil(file.bytes / 1024))} KB` : ''}</p></div>
      <div className="artifact-header-actions">
        {canSource && <div className="artifact-view-switch" role="group" aria-label="Vista del archivo"><button type="button" aria-label="Vista previa" title="Vista previa" aria-pressed={!source} onClick={() => setSource(false)}><ActionIcon kind="preview" /></button><button type="button" aria-label="Código" title="Código" aria-pressed={source} onClick={() => setSource(true)}><ActionIcon kind="code" /></button></div>}
        <button type="button" aria-label="Guardar copia" disabled={busy || !preview} title="Guardar copia" onClick={() => void operation('save')}><ActionIcon kind="save" /></button>
        {!['html', 'htm'].includes(file?.extension ?? '') && <button type="button" aria-label="Abrir fuera" disabled={busy || !preview} title="Abrir con la aplicación predeterminada" onClick={() => void operation('external')}><ActionIcon kind="external" /></button>}
        {!compact && <button type="button" title={expanded ? 'Reducir visor' : 'Ampliar visor'} aria-label={expanded ? 'Reducir visor' : 'Ampliar visor'} onClick={onExpand}><ActionIcon kind={expanded ? 'reduce' : 'expand'} /></button>}
        <button type="button" aria-label="Cerrar visor" title="Cerrar visor" onClick={viewer.close}><ActionIcon kind="close" /></button>
      </div>
    </header>
    {viewer.files.length > 1 && <nav ref={tabs} className="artifact-file-tabs" aria-label="Archivos abiertos">{viewer.files.map(item => <button type="button" key={referenceKey(item.reference)} title={item.name} aria-pressed={referenceKey(reference) === referenceKey(item.reference)} onClick={() => viewer.select(item.reference)}><ArtifactFileIcon extension={item.extension} small /><span>{item.name}</span></button>)}</nav>}
    {notice && <p role="status" className="artifact-preview-note">{notice}</p>}
    <div className="artifact-viewer-body">{error ? <div className="artifact-empty"><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div> : preview ? <ArtifactContent preview={preview} source={source} /> : <p className="artifact-empty" role="status">Abriendo archivo…</p>}</div>
  </>;
}
const drawings = {
  preview: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  code: 'm8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16',
  save: 'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',
  external: 'M14 3h7v7m0-7L10 14M10 3H4v17h16v-6',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  reduce: 'M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5',
  close: 'm6 6 12 12M6 18 18 6',
};
function ActionIcon({ kind }: { kind: keyof typeof drawings }) {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={drawings[kind]} /></svg>;
}
