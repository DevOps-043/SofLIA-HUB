import { useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioChat } from './StudioChat';
import { StudioActivities } from './StudioActivities';
import { StudioPreview } from './StudioPreview';
import { StudioMediaDock } from './StudioMediaDock';
import type { StudioExamples, StudioRoom, StudioViewMode } from './studio-types';
import './instructor-studio.css';
import './studio-panels.css';
import './studio-controls.css';
import './studio-scenes.css';

export function InstructorStudio({ title = 'Estudio de la sesión', instructorName = 'Instructor', examples, onBack, onClose }: {
  title?: string; instructorName?: string; examples?: StudioExamples; onBack: () => void; onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<StudioViewMode>('combined');
  const [rooms, setRooms] = useState<StudioRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  function updateRooms(next: StudioRoom[]) { setRooms(next); setActiveRoomId(null); }
  function visitRoom(id: string | null) { if (id && !rooms.some((room) => room.id === id)) return; setActiveRoomId(id); setMobilePanel('preview'); }
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(!!examples);
  const [screen, setScreen] = useState(!!examples);
  const [rehearsal, setRehearsal] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'preview' | 'chat' | 'activities'>('preview');
  const participants = examples?.participants ?? 0;
  return <section className={`instructor-studio show-${mobilePanel}`} aria-label="Estudio del instructor"><header className="studio-topbar"><div className="studio-session-heading"><button className="studio-icon-button" aria-label="Volver a mis sesiones" onClick={onBack}><LiveIcon name="back" /></button><span className="studio-brand-mark"><LiveIcon name="book" /></span><div><span>SOFLIA LEARNING <i>/</i> ESTUDIO DEL INSTRUCTOR</span><h1 title={title}>{title}</h1></div></div><div className="studio-topbar-actions"><span className="studio-design-badge" title="Los controles cambian solo esta vista, sin efectos en la sesión real."><LiveIcon name="grid" />Vista de diseño</span><button className={`studio-rehearse ${rehearsal ? 'is-rehearsing' : ''}`} onClick={() => setRehearsal(!rehearsal)}><i />{rehearsal ? 'Detener ensayo' : 'Ensayar transmisión'}</button><button className="studio-icon-button" aria-label="Cerrar aula" onClick={onClose}><LiveIcon name="close" /></button></div></header>
    <nav className="studio-mobile-nav" aria-label="Paneles del estudio"><button aria-pressed={mobilePanel === 'chat'} onClick={() => setMobilePanel('chat')}><LiveIcon name="chat" />Chat</button><button aria-pressed={mobilePanel === 'preview'} onClick={() => setMobilePanel('preview')}><LiveIcon name="video" />Transmisión</button><button aria-pressed={mobilePanel === 'activities'} onClick={() => setMobilePanel('activities')}><LiveIcon name="grid" />Actividades</button></nav>
    {rehearsal && <div className="studio-rehearsal-notice" role="status">Ensayo local activo · tu grupo no recibe esta transmisión.</div>}
    <div className="studio-layout"><StudioChat initialMessages={examples?.messages} room={activeRoom} /><StudioPreview viewMode={viewMode} onViewMode={setViewMode} screen={screen} camera={camera} mic={mic} initialScenes={examples?.scenes} instructorName={instructorName} room={activeRoom} /><StudioActivities initialResources={examples?.resources} participants={participants} rooms={rooms} onRoomsChange={updateRooms} /></div>
    <StudioMediaDock mic={mic} camera={camera} screen={screen} onMic={() => setMic(!mic)} onCamera={() => setCamera(!camera)} onScreen={() => setScreen(!screen)} onClose={onClose} participants={participants} rooms={rooms} activeRoom={activeRoom} onVisitRoom={visitRoom} />
  </section>;
}
