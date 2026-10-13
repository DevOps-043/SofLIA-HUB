import { useState } from 'react';
import { useStudioRuntime } from './StudioRuntimeContext';
import { useStudioMediaRuntime } from './StudioMediaContext';
import { LiveIcon } from '../LiveIcon';
import { StudioChat } from './StudioChat';
import { StudioActivities } from './StudioActivities';
import { StudioPreview } from './StudioPreview';
import { StudioMediaDock } from './StudioMediaDock';
import { useStudioScenes } from './useStudioScenes';
import { useStudioSceneSharing } from './useStudioSceneSharing';
import type { StudioExamples, StudioRoom, StudioViewMode } from './studio-types';
import './instructor-studio.css';
import './studio-panels.css';
import './studio-controls.css';
import './studio-scenes.css';

export function InstructorStudio({ title = 'Estudio de la sesión', instructorName = 'Instructor', examples, onBack, onClose }: {
  title?: string; instructorName?: string; examples?: StudioExamples; onBack: () => void; onClose: () => void;
}) {
  const runtime = useStudioRuntime();
  const media = useStudioMediaRuntime();
  const scenes = useStudioScenes(examples?.scenes ?? runtime?.snapshot.state.scenes.map((scene) => ({ ...scene, assetUrl: scene.asset_path ? runtime.snapshot.asset_urls[scene.asset_path] : undefined })));
  const [viewMode, setViewMode] = useState<StudioViewMode>('combined');
  const [localRooms, setRooms] = useState<StudioRoom[]>([]);
  const [localRoomId, setActiveRoomId] = useState<string | null>(null);
  const rooms = runtime ? runtime.snapshot.state.rooms.map((room) => ({ id: room.id, name: room.name, participants: room.user_ids.length })) : localRooms;
  const activeRoomId = runtime ? runtime.snapshot.state.members.find((member) => member.user_id === runtime.snapshot.user_id)?.room_id ?? null : localRoomId;
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  function updateRooms(next: StudioRoom[]) { if (runtime) { if (!next.length) void runtime.send({ type: 'close_rooms' }); return; } setRooms(next); setActiveRoomId(null); }
  function visitRoom(id: string | null) { if (id && !rooms.some((room) => room.id === id)) return; if (runtime) void runtime.send({ type: 'presence', room_id: id }); else setActiveRoomId(id); setMobilePanel('preview'); }
  const [localMic, setMic] = useState(false);
  const [localCamera, setCamera] = useState(!!examples);
  const [localScreen, setScreen] = useState(!!examples);
  const [rehearsal, setRehearsal] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'preview' | 'chat' | 'activities'>('preview');
  const mic = media ? media.zoomConnected ? media.zoomMic : !!media.mic : localMic;
  const camera = media ? media.zoomConnected ? media.zoomCamera : !!media.camera : localCamera;
  const screen = media ? !!media.screen || media.zoomSharing : localScreen;
  const { sceneError, scenePending, selectScene, addScene, relinkScene, removeScene, shareScene } = useStudioSceneSharing(scenes, media, () => setScreen(!localScreen));
  const participants = runtime ? runtime.snapshot.state.members.filter((member) => !member.instructor).length : examples?.participants ?? 0;
  return <section className={`instructor-studio show-${mobilePanel}`} aria-label="Estudio del instructor"><header className="studio-topbar"><div className="studio-session-heading"><button className="studio-icon-button" aria-label="Volver a mis sesiones" onClick={onBack}><LiveIcon name="back" /></button><span className="studio-brand-mark"><LiveIcon name="book" /></span><div><span>SOFLIA LEARNING <i>/</i> ESTUDIO DEL INSTRUCTOR</span><h1 title={title}>{title}</h1></div></div><div className="studio-topbar-actions"><span className="studio-design-badge"><LiveIcon name="grid" />{runtime ? runtime.realtime : 'Vista de diseño'}</span><>{runtime && <button className="studio-icon-button" aria-label="Actualizar estudio" disabled={runtime.busy} onClick={() => void runtime.refresh()}><LiveIcon name="refresh" /></button>}</><button className={`studio-rehearse ${rehearsal ? 'is-rehearsing' : ''}`} disabled={media?.zoomPending} onClick={() => media ? media.connectZoom() : setRehearsal(!rehearsal)}><i />{media ? media.zoomConnected ? 'Zoom conectado' : media.zoomPending ? 'Conectando Zoom…' : 'Conectar Zoom' : rehearsal ? 'Detener ensayo' : 'Ensayar transmisión'}</button><button className="studio-icon-button" aria-label="Cerrar aula" onClick={onClose}><LiveIcon name="close" /></button></div></header>
    <nav className="studio-mobile-nav" aria-label="Paneles del estudio"><button aria-pressed={mobilePanel === 'chat'} onClick={() => setMobilePanel('chat')}><LiveIcon name="chat" />Chat</button><button aria-pressed={mobilePanel === 'preview'} onClick={() => setMobilePanel('preview')}><LiveIcon name="video" />Transmisión</button><button aria-pressed={mobilePanel === 'activities'} onClick={() => setMobilePanel('activities')}><LiveIcon name="grid" />Actividades</button></nav>
    {rehearsal && <div className="studio-rehearsal-notice" role="status">Ensayo local activo · tu grupo no recibe esta transmisión.</div>}
    {sceneError && <div className="studio-rehearsal-notice" role="status">{sceneError}</div>}
    <div className="studio-layout"><StudioChat initialMessages={examples?.messages} room={activeRoom} /><StudioPreview viewMode={viewMode} onViewMode={setViewMode} screen={screen} camera={camera} mic={mic} sceneBank={scenes} onSelect={(id) => void selectScene(id)} onRemove={removeScene} onAdd={addScene} onRelink={(id) => void relinkScene(id)} pending={scenePending} instructorName={instructorName} room={activeRoom} /><StudioActivities initialResources={examples?.resources} participants={participants} rooms={rooms} onRoomsChange={updateRooms} /></div>
    <StudioMediaDock mic={mic} camera={camera} screen={screen} capturePending={scenePending} onMic={() => media ? media.zoomConnected ? media.muteZoom() : void media.toggle('mic') : setMic(!mic)} onCamera={() => media ? void media.toggle('camera') : setCamera(!camera)} onScreen={() => void shareScene()} onClose={onClose} participants={participants} rooms={rooms} activeRoom={activeRoom} onVisitRoom={visitRoom} />
  </section>;
}
