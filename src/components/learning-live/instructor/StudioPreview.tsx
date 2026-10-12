import { LiveIcon } from '../LiveIcon';
import { StudioSceneBank } from './StudioSceneBank';
import { StudioSceneCanvas } from './StudioSceneCanvas';
import { useStudioScenes } from './useStudioScenes';
import type { StudioPreparedScene, StudioRoom, StudioViewMode } from './studio-types';

export function StudioPreview({ viewMode, onViewMode, screen, camera, mic, initialScenes, instructorName, room }: {
  viewMode: StudioViewMode; onViewMode: (mode: StudioViewMode) => void; screen: boolean; camera: boolean; mic: boolean;
  initialScenes?: StudioPreparedScene[]; instructorName: string; room: StudioRoom | null;
}) {
  const { scenes, activeScene, addScene, removeScene, selectScene } = useStudioScenes(initialScenes);
  const showContent = viewMode !== 'camera';
  const showCamera = camera && viewMode !== 'screen';
  function showScene(id: string) { selectScene(id); if (viewMode === 'camera') onViewMode(camera ? 'combined' : 'screen'); }
  return <main className="studio-production" aria-label="Vista previa de transmisión"><header className="studio-production-heading"><div><span className="studio-eyebrow">{room ? 'RETROALIMENTACIÓN' : 'TU ESPACIO DE TRANSMISIÓN'}</span><h2>{room?.name || 'Tu transmisión'}</h2></div><div className="studio-preview-tools"><span><i />Vista previa</span><div className="studio-view-modes" role="group" aria-label="Modo de vista previa">{([{ id: 'screen', title: 'Pantalla', label: 'Ver solo pantalla', icon: 'screen' }, { id: 'camera', title: 'Cámara', label: 'Ver solo cámara', icon: 'video' }, { id: 'combined', title: 'Combinada', label: 'Ver pantalla y cámara', icon: 'grid' }] as const).map((mode) => <button key={mode.id} aria-label={mode.label} title={mode.title} aria-pressed={viewMode === mode.id} onClick={() => onViewMode(mode.id)}><LiveIcon name={mode.icon} /><span>{mode.title}</span></button>)}</div></div></header>
    {room && <div className="studio-room-stage" role="status"><LiveIcon name="users" /><span>{room.name} · {room.participants} participantes</span><small>Visita de diseño</small></div>}
    <div className={`studio-video-frame scene-${viewMode}`} role="region" aria-label="Escenario seleccionado"><div className="studio-preview-label"><LiveIcon name="video" />VISTA LOCAL</div>
      {showContent && activeScene ? <StudioSceneCanvas key={activeScene.id} scene={activeScene} /> : showContent ? <div className="studio-preview-empty"><LiveIcon name="screen" /><h3>Tu siguiente escena, aquí.</h3><p>Prepara una lámina, pantalla o archivo<br />y selecciónalo en Escenas.</p></div> : !showCamera ? <div className="studio-preview-empty"><LiveIcon name="video" /><h3>Cámara apagada</h3><p>Activa la cámara para preparar esta composición.</p></div> : null}
      {showCamera && <div className={`studio-camera-preview ${showContent ? 'is-overlay' : ''}`}><div className="studio-camera-backdrop" /><span className="studio-camera-avatar">{instructorName.slice(0, 1)}</span><span className="studio-camera-caption"><LiveIcon name={mic ? 'mic' : 'micOff'} />{instructorName}<small>Cámara de ejemplo</small></span></div>}
    </div>
    <div className="studio-preview-caption"><span><i />{room?.name || 'Grupo principal'}{activeScene ? ` · ${activeScene.name}` : ''}</span><span>Solo tú ves esta composición</span></div>
    <StudioSceneBank scenes={scenes} activeId={activeScene?.id ?? null} onSelect={showScene} onRemove={removeScene} onAdd={addScene} />
    <section className="studio-source-strip" aria-label="Fuentes de transmisión"><span>FUENTES</span><span className={screen ? 'source-active' : ''}><LiveIcon name="screen" />Pantalla<i /></span><span className={camera ? 'source-active' : ''}><LiveIcon name="video" />Cámara<i /></span><span className={mic ? 'source-active' : ''}><LiveIcon name="mic" />Micrófono<i /></span></section>
  </main>;
}
