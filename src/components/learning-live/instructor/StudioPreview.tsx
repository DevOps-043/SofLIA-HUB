import { useStudioMediaRuntime } from './StudioMediaContext';
import { useStudioRuntime } from './StudioRuntimeContext';
import { StudioStreamVideo } from './StudioStreamVideo';
import { LiveIcon } from '../LiveIcon';
import { StudioSceneBank } from './StudioSceneBank';
import { StudioSceneCanvas } from './StudioSceneCanvas';
import { useStudioScenes } from './useStudioScenes';
import type { StudioRoom, StudioViewMode } from './studio-types';
import type { StudioSceneDraft } from './useStudioScenes';

export function StudioPreview({ viewMode, onViewMode, screen, camera, mic, sceneBank, onSelect, onRemove, onAdd, onRelink, pending, instructorName, room }: {
  viewMode: StudioViewMode; onViewMode: (mode: StudioViewMode) => void; screen: boolean; camera: boolean; mic: boolean;
  sceneBank: ReturnType<typeof useStudioScenes>; onSelect: (id: string) => void; onRemove: (id: string) => void; onAdd: (draft: StudioSceneDraft) => string | null; onRelink: (id: string) => void; pending: boolean; instructorName: string; room: StudioRoom | null;
}) {
  const media = useStudioMediaRuntime();
  const runtime = useStudioRuntime();
  const { scenes, activeScene } = sceneBank;
  const showContent = viewMode !== 'camera';
  const showCamera = camera && !media?.zoomStage && viewMode !== 'screen';
  function showScene(id: string) { onSelect(id); if (viewMode === 'camera') onViewMode(camera ? 'combined' : 'screen'); }
  return <main className="studio-production" aria-label="Vista previa de transmisión"><header className="studio-production-heading"><div><span className="studio-eyebrow">{room ? 'RETROALIMENTACIÓN' : 'TU ESPACIO DE TRANSMISIÓN'}</span><h2>{room?.name || 'Tu transmisión'}</h2></div><div className="studio-preview-tools"><span><i />Vista previa</span><div className="studio-view-modes" role="group" aria-label="Modo de vista previa">{([{ id: 'screen', title: 'Pantalla', label: 'Ver solo pantalla', icon: 'screen' }, { id: 'camera', title: 'Cámara', label: 'Ver solo cámara', icon: 'video' }, { id: 'combined', title: 'Combinada', label: 'Ver pantalla y cámara', icon: 'grid' }] as const).map((mode) => <button key={mode.id} aria-label={mode.label} title={mode.title} aria-pressed={viewMode === mode.id} onClick={() => onViewMode(mode.id)}><LiveIcon name={mode.icon} /><span>{mode.title}</span></button>)}</div></div></header>
    {room && <div className="studio-room-stage" role="status"><LiveIcon name="users" /><span>{room.name} · {room.participants} participantes</span><small>{runtime ? 'Sala académica · audio gestionado en la llamada' : 'Visita de diseño'}</small></div>}
    {media?.zoomStage && <div className="studio-zoom-stage">{media.zoomStage}</div>}
    <div className={`studio-video-frame scene-${viewMode}`} role="region" aria-label="Escenario seleccionado"><div className="studio-preview-label"><LiveIcon name="video" />VISTA LOCAL</div>
      {showContent && media?.screen && (!activeScene || activeScene.kind === 'screen') ? <StudioStreamVideo stream={media.screen} label="Pantalla compartida local" /> : showContent && activeScene ? <StudioSceneCanvas key={activeScene.id} scene={activeScene} /> : showContent ? <div className="studio-preview-empty"><LiveIcon name="screen" /><h3>Tu siguiente escena, aquí.</h3><p>Prepara una lámina, pantalla o archivo<br />y selecciónalo en Escenas.</p></div> : !showCamera ? <div className="studio-preview-empty"><LiveIcon name="video" /><h3>Cámara apagada</h3><p>Activa la cámara para preparar esta composición.</p></div> : null}
      {showCamera && <div className={`studio-camera-preview ${showContent ? 'is-overlay' : ''}`}><div className="studio-camera-backdrop" />{media?.camera ? <StudioStreamVideo stream={media.camera} label="Cámara local del instructor" /> : <span className="studio-camera-avatar">{instructorName.slice(0, 1)}</span>}<span className="studio-camera-caption"><LiveIcon name={mic ? 'mic' : 'micOff'} />{instructorName}<small>{media ? 'Vista local' : 'Cámara de ejemplo'}</small></span></div>}
    </div>
    <div className="studio-preview-caption"><span><i />{room?.name || 'Grupo principal'}{activeScene ? ` · ${activeScene.name}` : ''}</span><span>{media?.zoomSharing ? activeScene?.capture ? 'Transmitiendo la fuente ligada' : 'Compartiendo pantalla en la llamada' : media?.screen ? 'Vista local de la fuente ligada' : activeScene?.capture ? media?.zoomConnected ? 'Fuente ligada · inicia Compartir en la llamada' : 'Fuente ligada · pulsa Compartir' : 'Solo tú ves esta composición'}</span></div>
    <StudioSceneBank scenes={scenes} activeId={activeScene?.id ?? null} onSelect={showScene} onRemove={onRemove} onAdd={onAdd} onRelink={onRelink} capturePending={pending} />
    <section className="studio-source-strip" aria-label="Fuentes de transmisión"><span>FUENTES</span><span className={screen ? 'source-active' : ''}><LiveIcon name="screen" />Pantalla<i /></span><span className={camera ? 'source-active' : ''}><LiveIcon name="video" />Cámara<i /></span><span className={mic ? 'source-active' : ''}><LiveIcon name="mic" />Micrófono<i /></span></section>
  </main>;
}
