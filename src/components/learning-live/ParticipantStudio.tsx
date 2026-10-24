import { useState } from 'react';
import { useStudioRuntime } from './instructor/StudioRuntimeContext';
import { useStudioMediaRuntime } from './instructor/StudioMediaContext';
import { StudioLiveClock } from './instructor/StudioLiveClock';
import { LiveIcon } from './LiveIcon';
import { ParticipantStage } from './participant/ParticipantStage';
import { ParticipantActivities } from './participant/ParticipantActivities';
import { ParticipantConversations } from './participant/ParticipantConversations';
import { ParticipantToolbar } from './participant/ParticipantToolbar';
import './instructor/instructor-studio.css';
import './instructor/studio-panels.css';
import './instructor/studio-controls.css';
import './instructor/studio-scenes.css';
import './participant/participant-studio.css';

export function ParticipantStudio({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const {snapshot}=useStudioRuntime()!;
  const media=useStudioMediaRuntime()!;
  const [practiceId,setPracticeId]=useState<string>();
  const [mobile,setMobile]=useState<'class'|'chat'>('class');
  const {state,user_id}=snapshot;
  const current=state.members.find(member=>member.user_id===user_id)?.room_id;
  const room=state.rooms.find(item=>item.id===current);
  return <section className={`instructor-studio participant-studio participant-show-${mobile}`} aria-label="Aula del participante">
    <header className="studio-topbar participant-topbar"><div className="studio-session-heading"><button className="studio-icon-button" aria-label="Volver a mis sesiones" onClick={onBack}><LiveIcon name="back"/></button><span className="studio-brand-mark"><LiveIcon name="book"/></span><div><span>SOFLIA LEARNING <i>/</i> MI CLASE</span><h1 title={snapshot.title}>{snapshot.title}</h1></div></div><div className="participant-session-status"><span><LiveIcon name="users"/>{state.members.length} participantes</span><button className="participant-join" disabled={media.zoomPending||media.zoomConnected} onClick={media.connectZoom}>{media.zoomConnected?'Sesión conectada':media.zoomPending?'Conectando…':'Unirme a la sesión'}</button></div></header>
    <nav className="participant-mobile-tabs" aria-label="Vistas del aula"><button aria-pressed={mobile==='class'} onClick={()=>setMobile('class')}><LiveIcon name="video"/>Clase</button><button aria-pressed={mobile==='chat'} onClick={()=>setMobile('chat')}><LiveIcon name="chat"/>Conversaciones</button></nav>
    <div className="participant-layout"><main className="participant-learning-area" aria-label="Contenido de la sesión"><ParticipantStage/><div className="participant-learning-caption"><span>{room?`Trabajando con ${room.name}`:'Aprende y participa con tu grupo'}</span><StudioLiveClock compact/></div><ParticipantActivities onPractice={setPracticeId}/><ParticipantToolbar onClose={onClose}/></main><ParticipantConversations room={room?{id:room.id,name:room.name,participants:room.user_ids.length}:null} practiceId={practiceId}/></div>
  </section>;
}
