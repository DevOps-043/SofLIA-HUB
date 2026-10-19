import { useEffect, useRef, useState, type FormEvent } from 'react';
import { studioCapture } from '../../../services/studio-capture';
import SelectDropdown from '../../ui/SelectDropdown';
import { LiveIcon } from '../LiveIcon';
import { StudioDialog } from './StudioDialog';
import type { StudioSceneDraft } from './useStudioScenes';
import { HOLDING_PRESETS, type StudioHolding } from '../../../shared/studio-program';

export function StudioSceneEditor({ onAdd, onClose, initialKind = 'slide', visualOnly = false }: { onAdd: (draft: StudioSceneDraft) => string | null | Promise<string | null>; onClose: () => void; initialKind?: StudioSceneDraft['kind']; visualOnly?: boolean }) {
  const [draft, setDraft] = useState<StudioSceneDraft>({ name: '', kind: initialKind, title: '', description: '', file: null });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const choosing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftBindings = useRef(new Set<string>());
  useEffect(() => {
    alive.current = true;
    const bindings = draftBindings.current;
    return () => { alive.current = false; bindings.forEach((id) => void studioCapture.release(id).catch(() => console.warn('[Estudio] No se pudo liberar una fuente de edición.'))); bindings.clear(); };
  }, []);
  async function choose() {
    if (choosing.current) return;
    choosing.current = true; setPending(true); setError('');
    try {
      const capture = await studioCapture.choose();
      if (!capture) return;
      if (!alive.current) { await studioCapture.release(capture.id); return; }
      draftBindings.current.add(capture.id);
      if (draft.capture) { await studioCapture.release(draft.capture.id); draftBindings.current.delete(draft.capture.id); }
      setDraft((current) => ({ ...current, capture, title: capture.name }));
    } catch { if (alive.current) setError('No pudimos vincular la fuente. Revisa que la ventana o pestaña esté abierta e intenta otra vez.'); }
    finally { choosing.current = false; if (alive.current) setPending(false); }
  }
  function changeKind(kind: StudioSceneDraft['kind']) {
    if (draft.capture) { draftBindings.current.delete(draft.capture.id); void studioCapture.release(draft.capture.id).catch(() => console.warn('[Estudio] No se pudo liberar la fuente anterior.')); }
    const preset = HOLDING_PRESETS.waiting;
    setDraft({ ...draft, kind, capture: null, file: null, title: kind === 'holding' ? preset.title : '', description: kind === 'holding' ? preset.description : draft.description, holding: kind === 'holding' ? { phase: 'waiting', seconds: 0 } : undefined }); setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    if (visualOnly && draft.file?.type.startsWith('video/')) { setError('El contenido intermedio admite imágenes o pantallas.'); return; }
    setPending(true); setError('');
    try {
      const result = await onAdd(draft);
      if (!alive.current) return;
      if (result) { setError(result); return; }
      if (draft.capture) draftBindings.current.delete(draft.capture.id);
      onClose();
    } catch { if (alive.current) setError('No pudimos crear la escena. Vuelve a intentar.'); }
    finally { if (alive.current) setPending(false); }
  }
  return <StudioDialog title="Preparar una escena" onClose={onClose}><form onSubmit={submit}>
    <label>Nombre de la escena<input autoFocus required disabled={pending} maxLength={60} placeholder="Presentación, práctica, descanso…" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
    <label htmlFor="studio-scene-kind">Contenido<SelectDropdown id="studio-scene-kind" aria-label="Contenido de la escena" className="studio-select" value={draft.kind} disabled={pending} onChange={(kind) => changeKind(kind as StudioSceneDraft['kind'])} options={[{ value: 'slide', label: 'Lámina con texto' }, { value: 'screen', label: 'Pantalla, ventana o pestaña' }, { value: 'media', label: visualOnly ? 'Imagen local' : 'Imagen o video local' }, { value: 'holding', label: 'Pantalla de curso con reloj' }]} /></label>
    {draft.kind === 'holding' && <><label>Momento del curso<select aria-label="Momento del curso" value={draft.holding?.phase} onChange={(event) => { const phase = event.target.value as StudioHolding['phase']; const preset = HOLDING_PRESETS[phase]; setDraft({ ...draft, title: preset.title, description: preset.description, holding: { phase, seconds: preset.seconds } }); }}>{Object.entries(HOLDING_PRESETS).map(([phase, preset]) => <option key={phase} value={phase}>{preset.name}</option>)}</select></label><label>Cuenta regresiva (minutos, 0 sin reloj)<input aria-label="Cuenta regresiva en minutos" type="number" min={0} max={120} step={1} value={(draft.holding?.seconds || 0) / 60} onChange={(event) => setDraft({ ...draft, holding: { phase: draft.holding?.phase || 'waiting', seconds: Number(event.target.value) * 60 } })} /></label></>}
    {draft.kind === 'screen' ? <div className="studio-scene-source-binding">{draft.capture?.thumbnail && <img src={draft.capture.thumbnail} alt={`Fuente ligada: ${draft.capture.name}`} />}<button type="button" disabled={pending} onClick={() => void choose()}><LiveIcon name="screen" /><span>{draft.capture ? 'Cambiar fuente' : 'Vincular fuente'}</span></button>{draft.capture ? <strong>{draft.capture.name}</strong> : <small>Elige una fuente real con vista previa.</small>}</div>
      : draft.kind === 'media' ? <div className="studio-scene-file"><input ref={fileInput} className="studio-sr-only" type="file" aria-label="Archivo de la escena" accept={visualOnly ? 'image/png,image/jpeg,image/webp,image/gif,image/avif' : 'image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm'} onChange={(event) => { setDraft({ ...draft, file: event.target.files?.[0] ?? null }); setError(''); }} /><button type="button" onClick={() => fileInput.current?.click()}><LiveIcon name="file" />{draft.file?.name || (visualOnly ? 'Elegir imagen' : 'Elegir imagen o video')}</button><small>Archivo local · hasta 25 MB</small></div>
        : <label>Título de la lámina<textarea rows={2} maxLength={160} placeholder="Lo que verás en esta escena" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>}
    <label>Descripción<textarea rows={2} maxLength={500} placeholder="Una indicación breve para esta escena" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    <p className="studio-muted">La escena se crea en este estudio. {draft.kind === 'screen' ? 'La fuente permanece ligada al detener y volver a compartir.' : 'La preparación se ve solo aquí hasta que compartas.'}</p>
    {error && <p role="alert">{error}</p>}<button type="submit" disabled={pending || draft.kind === 'screen' && !draft.capture} className="studio-primary-button">{pending ? 'Preparando…' : 'Guardar escena'}</button>
  </form></StudioDialog>;
}
