import { useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioSceneEditor } from './StudioSceneEditor';
import type { StudioPreparedScene } from './studio-types';
import type { StudioSceneDraft } from './useStudioScenes';

export function StudioSceneBank({ scenes, activeId, onSelect, onRemove, onAdd, onRelink, capturePending = false }: {
  scenes: StudioPreparedScene[]; activeId: string | null; onSelect: (id: string) => void; onRemove: (id: string) => void; onAdd: (draft: StudioSceneDraft) => string | null | Promise<string | null>; onRelink: (id: string) => void; capturePending?: boolean;
}) {
  const [editor, setEditor] = useState(false);
  return <section className="studio-scenes-section" aria-label="Escenas"><header><h3>Escenas</h3><button className="studio-scene-add" aria-label="Nueva escena" title="Nueva escena" disabled={scenes.length >= 12 || capturePending} onClick={() => setEditor(true)}><LiveIcon name="plus" /></button></header>
    <div className="studio-scene-list" role="group" aria-label="Seleccionar escena">{scenes.map((scene) => <article key={scene.id} className={`studio-scene-row ${scene.id === activeId ? 'is-selected' : ''}`}>
      <button disabled={capturePending} aria-label={`Mostrar escena ${scene.name}`} aria-pressed={scene.id === activeId} title={scene.name} onClick={() => onSelect(scene.id)}><LiveIcon name={scene.kind === 'screen' ? 'screen' : scene.kind === 'video' ? 'video' : scene.kind === 'image' ? 'grid' : 'file'} /><span>{scene.name}</span><i aria-hidden="true" /></button>
      {scene.kind === 'screen' && <button className="studio-scene-relink studio-icon-button" title={scene.capture?.name || 'Vincular fuente'} disabled={capturePending} aria-label={`Cambiar fuente de ${scene.name}`} onClick={() => onRelink(scene.id)}><LiveIcon name="screen" /></button>}
      <button disabled={capturePending} className="studio-scene-remove studio-icon-button" aria-label={`Quitar escena ${scene.name}`} onClick={() => onRemove(scene.id)}><LiveIcon name="close" /></button>
    </article>)}</div>
    {scenes.length === 0 && <p className="studio-scene-bank-empty">Añade tu primera escena con +</p>}
    {editor && <StudioSceneEditor onAdd={onAdd} onClose={() => setEditor(false)} />}
  </section>;
}
