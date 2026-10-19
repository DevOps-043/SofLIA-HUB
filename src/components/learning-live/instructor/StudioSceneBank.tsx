import { useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioSceneEditor } from './StudioSceneEditor';
import type { StudioPreparedScene } from './studio-types';
import type { StudioSceneDraft } from './useStudioScenes';

export function StudioSceneBank({ scenes, activeId, onSelect, onRemove, onAdd, onRelink, capturePending = false }: {
  scenes: StudioPreparedScene[]; activeId: string | null; onSelect: (id: string) => void; onRemove: (id: string) => void; onAdd: (draft: StudioSceneDraft) => string | null | Promise<string | null>; onRelink: (id: string) => void; capturePending?: boolean;
}) {
  const [editor, setEditor] = useState(false);
  return <section className="studio-scenes-section" aria-label="Escenas preparadas"><header><div><h3>Escenas</h3><span>Tus escenas y fuentes, preparadas en este equipo</span></div><button className="studio-scene-add" disabled={scenes.length >= 12 || capturePending} onClick={() => setEditor(true)}><LiveIcon name="plus" />Nueva escena</button></header>
    <div className="studio-scene-bank-grid">{scenes.map((scene, index) => <article key={scene.id} className={`studio-scene-card ${scene.id === activeId ? 'is-selected' : ''}`}>
      <button disabled={capturePending} aria-label={`Mostrar escena ${scene.name}`} aria-pressed={scene.id === activeId} onClick={() => onSelect(scene.id)}><div className={`studio-bank-thumbnail kind-${scene.kind}`}>
        {scene.kind === 'screen' && scene.capture?.thumbnail ? <img src={scene.capture.thumbnail} alt="" /> : scene.kind === 'image' && scene.assetUrl ? <img src={scene.assetUrl} alt="" /> : <LiveIcon name={scene.kind === 'screen' ? 'screen' : scene.kind === 'video' ? 'video' : 'file'} />}
        {(scene.kind === 'slide' || scene.kind === 'holding') && <span>{scene.title}</span>}<b>{String(index + 1).padStart(2, '0')}</b>
      </div><div className="studio-scene-card-title"><strong>{scene.name}</strong><small>{scene.id === activeId ? 'En vista previa' : scene.kind === 'screen' ? scene.capture?.name || 'Sin fuente ligada' : scene.kind === 'holding' ? 'Pantalla de curso' : scene.kind === 'slide' ? 'Lámina local' : 'Archivo local'}</small></div></button>
      {scene.kind === 'screen' && <button className="studio-scene-relink" disabled={capturePending} aria-label={`Cambiar fuente de ${scene.name}`} onClick={() => onRelink(scene.id)}><LiveIcon name="screen" />{scene.capture ? 'Cambiar fuente' : 'Vincular fuente'}</button>}
      <button disabled={capturePending} className="studio-scene-remove studio-icon-button" aria-label={`Quitar escena ${scene.name}`} onClick={() => onRemove(scene.id)}><LiveIcon name="close" /></button>
    </article>)}</div>
    {scenes.length === 0 && <div className="studio-scene-bank-empty"><LiveIcon name="grid" /><p>Prepara tu primera escena</p><span>Vincula una pantalla, ventana o pestaña, o añade una lámina o archivo local.</span></div>}
    {editor && <StudioSceneEditor onAdd={onAdd} onClose={() => setEditor(false)} />}
  </section>;
}
