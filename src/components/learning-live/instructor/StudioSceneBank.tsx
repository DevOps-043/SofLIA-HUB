import { useRef, useState, type FormEvent } from 'react';
import { LiveIcon } from '../LiveIcon';
import SelectDropdown from '../../ui/SelectDropdown';
import { StudioDialog } from './StudioDialog';
import type { StudioPreparedScene } from './studio-types';
import type { StudioSceneDraft } from './useStudioScenes';

export function StudioSceneBank({ scenes, activeId, onSelect, onRemove, onAdd }: {
  scenes: StudioPreparedScene[]; activeId: string | null; onSelect: (id: string) => void; onRemove: (id: string) => void; onAdd: (draft: StudioSceneDraft) => string | null;
}) {
  const [editor, setEditor] = useState(false);
  const [draft, setDraft] = useState<StudioSceneDraft>({ name: '', kind: 'slide', title: '', description: '', file: null });
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const result = onAdd(draft);
    if (result) { setError(result); return; }
    setEditor(false); setDraft({ name: '', kind: 'slide', title: '', description: '', file: null }); setError('');
  }
  return <section className="studio-scenes-section" aria-label="Escenas preparadas"><header><div><h3>Escenas</h3><span>Tu contenido, listo antes de empezar</span></div><button className="studio-scene-add" disabled={scenes.length >= 12} onClick={() => { setError(''); setEditor(true); }}><LiveIcon name="plus" />Nueva escena</button></header>
    <div className="studio-scene-bank-grid">{scenes.map((scene, index) => <article key={scene.id} className={`studio-scene-card ${scene.id === activeId ? 'is-selected' : ''}`}><button aria-label={`Mostrar escena ${scene.name}`} aria-pressed={scene.id === activeId} onClick={() => onSelect(scene.id)}><div className={`studio-bank-thumbnail kind-${scene.kind}`}>
      {scene.kind === 'image' && scene.assetUrl ? <img src={scene.assetUrl} alt="" /> : <LiveIcon name={scene.kind === 'screen' ? 'screen' : scene.kind === 'video' ? 'video' : 'file'} />}
      {scene.kind === 'slide' && <span>{scene.title}</span>}<b>{String(index + 1).padStart(2, '0')}</b>
    </div><div className="studio-scene-card-title"><strong>{scene.name}</strong><small>{scene.id === activeId ? 'En vista previa' : scene.kind === 'screen' ? 'Pantalla preparada' : scene.kind === 'slide' ? 'Lámina' : 'Archivo local'}</small></div></button><button className="studio-scene-remove studio-icon-button" aria-label={`Quitar escena ${scene.name}`} onClick={() => onRemove(scene.id)}><LiveIcon name="close" /></button></article>)}</div>
    {scenes.length === 0 && <div className="studio-scene-bank-empty"><LiveIcon name="grid" /><p>Prepara tu primera escena</p><span>Añade láminas, pantallas, imágenes o videos para cambiar con un clic.</span></div>}
    {editor && <StudioDialog title="Preparar una escena" onClose={() => setEditor(false)}><form onSubmit={submit}><label>Nombre de la escena<input autoFocus required maxLength={60} placeholder="Presentación, práctica, descanso…" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label htmlFor="studio-scene-kind">Contenido<SelectDropdown id="studio-scene-kind" aria-label="Contenido de la escena" className="studio-select" value={draft.kind} onChange={(kind) => { setDraft({ ...draft, kind: kind as StudioSceneDraft['kind'], file: null }); setError(''); }} options={[{ value: 'slide', label: 'Lámina con texto' }, { value: 'screen', label: 'Pantalla o ventana' }, { value: 'media', label: 'Imagen o video local' }]} /></label>
      {draft.kind === 'media' ? <div className="studio-scene-file"><input ref={fileInput} className="studio-sr-only" type="file" aria-label="Archivo de la escena" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm" onChange={(event) => { setDraft({ ...draft, file: event.target.files?.[0] ?? null }); setError(''); }} /><button type="button" onClick={() => fileInput.current?.click()}><LiveIcon name="file" />{draft.file?.name || 'Elegir imagen o video'}</button><small>Archivo local · hasta 25 MB</small></div> : <><label>{draft.kind === 'screen' ? 'Nombre de la fuente' : 'Título de la lámina'}{draft.kind === 'slide' ? <textarea rows={2} maxLength={160} placeholder="Lo que verá tu grupo" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /> : <input maxLength={160} placeholder="Pantalla de la presentación" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />}</label><label>Descripción<textarea rows={2} maxLength={500} placeholder="Una indicación breve para esta escena" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label></>}
      <p className="studio-muted">Se prepara en esta vista. La transmisión real se conectará después.</p>{error && <p role="alert">{error}</p>}<button type="submit" className="studio-primary-button">Guardar escena</button></form></StudioDialog>}
  </section>;
}
