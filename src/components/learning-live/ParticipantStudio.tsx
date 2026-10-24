import { useStudioDimensions } from './useStudioDimensions';
import { useRef, useState, type CSSProperties } from 'react';
import { useStudioRuntime } from './instructor/StudioRuntimeContext';
import { StudioLiveClock } from './instructor/StudioLiveClock';
import { StudioResizeHandle } from './StudioResizeHandle';
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
  const layoutRef=useRef<HTMLDivElement>(null),learningRef=useRef<HTMLElement>(null);
  const layoutSize=useStudioDimensions(layoutRef),learningSize=useStudioDimensions(learningRef);
  const [chatWidth,setChatWidth]=useState(340),[activityHeight,setActivityHeight]=useState<number|null>(null),[activityExpanded,setActivityExpanded]=useState(false);
  const maxChat=Math.max(260,Math.min(900,(layoutSize.width||1280)-320-12));
  const actualChat=Math.max(260,Math.min(maxChat,chatWidth));
  const maxActivity=Math.max(88,(learningSize.height||600)-202);
  const actualActivity=Math.max(88,Math.min(maxActivity,activityHeight??(activityExpanded?Math.min(350,Math.max(210,(learningSize.height||600)*.4)):166)));
  const {snapshot}=useStudioRuntime()!;
  const [practiceId,setPracticeId]=useState<string>();
  const [mobile,setMobile]=useState<'class'|'chat'>('class');
  const {state,user_id}=snapshot;
  const current=state.members.find(member=>member.user_id===user_id)?.room_id;
  const room=state.rooms.find(item=>item.id===current);
  return <section className={`instructor-studio participant-studio participant-show-${mobile}`} aria-label="Aula del participante">
    <header className="studio-topbar participant-topbar"><div className="studio-session-heading"><button className="studio-icon-button" aria-label="Volver a mis sesiones" onClick={onBack}><LiveIcon name="back"/></button><span className="studio-brand-mark"><LiveIcon name="book"/></span><div><span>SOFLIA LEARNING <i>/</i> MI CLASE</span><h1 title={snapshot.title}>{snapshot.title}</h1></div></div><div className="participant-session-status"><span><LiveIcon name="users"/>{state.members.length} participantes</span></div></header>
    <nav className="participant-mobile-tabs" aria-label="Vistas del aula"><button aria-pressed={mobile==='class'} onClick={()=>setMobile('class')}><LiveIcon name="video"/>Clase</button><button aria-pressed={mobile==='chat'} onClick={()=>setMobile('chat')}><LiveIcon name="chat"/>Conversaciones</button></nav>
    <div ref={layoutRef} className="participant-layout participant-resizable-layout studio-resizable-region" style={{'--participant-chat-width':`${actualChat}px`} as CSSProperties}><main ref={learningRef} className="participant-learning-area studio-resizable-region" style={{'--participant-activity-height':`${actualActivity}px`} as CSSProperties} aria-label="Contenido de la sesión"><ParticipantStage/><div className="participant-learning-caption"><span>{room?`Trabajando con ${room.name}`:'Aprende y participa con tu grupo'}</span><StudioLiveClock compact/></div><StudioResizeHandle axis="height" side="after" label="Cambiar altura de actividades y transmisión" value={actualActivity} min={88} max={maxActivity} onChange={setActivityHeight} onReset={()=>setActivityHeight(null)}/><ParticipantActivities onPractice={setPracticeId} onExpandedChange={setActivityExpanded}/><ParticipantToolbar onClose={onClose}/></main><StudioResizeHandle axis="width" side="after" label="Cambiar ancho del chat y transmisión" value={actualChat} min={260} max={maxChat} onChange={setChatWidth} onReset={()=>setChatWidth(340)}/><ParticipantConversations room={room?{id:room.id,name:room.name,participants:room.user_ids.length}:null} practiceId={practiceId}/></div>
  </section>;
}
