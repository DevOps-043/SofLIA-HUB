import { useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioAudioSettings } from '../instructor/StudioAudioSettings';
import { useStudioMediaRuntime } from '../instructor/StudioMediaContext';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';
import { ParticipantRooms } from './ParticipantRooms';

export function ParticipantToolbar({onClose}:{onClose:()=>void}) {
  const media=useStudioMediaRuntime()!,runtime=useStudioRuntime()!;
  const [audio,setAudio]=useState(false),[rooms,setRooms]=useState(false),[reactions,setReactions]=useState(false),[notice,setNotice]=useState('');
  const {state,user_id}=runtime.snapshot;
  const member=state.members.find(item=>item.user_id===user_id);
  const room=state.rooms.find(item=>item.id===member?.room_id);
  const writable=!state.moderation.locked&&!state.moderation.restrictions[user_id];
  const mic=media.zoomConnected?media.zoomMic:!!media.mic;
  const camera=media.zoomConnected?media.zoomCamera:!!media.camera;
  async function post(content:string) {
    const ok=await runtime.send({type:'post',content,question:false,room_id:member?.room_id??null});
    setNotice(ok?'Enviado al chat de tu grupo.':'No se pudo enviar. Revisa los permisos del chat.');setReactions(false);
  }
  function toggle(kind:'mic'|'camera') {
    if(!media.zoomConnected){setNotice('Únete a la sesión antes de activar tus dispositivos.');return;}
    if(kind==='mic') media.muteZoom();
    else if(media.callControls?.camera)media.toggleZoomCamera?.();
    else setNotice('Activa la cámara desde los controles de la llamada. El instructor puede restringir su uso.');
  }
  return <><div className="participant-floating-controls">
    {notice&&<p className="participant-toolbar-notice" role="status">{notice}<button aria-label="Cerrar aviso de controles" onClick={()=>setNotice('')}><LiveIcon name="close"/></button></p>}
    {reactions&&<div className="participant-reactions" aria-label="Elegir reacción">{['👏','👍','💡','❤️'].map(emoji=><button key={emoji} aria-label={`Enviar reacción ${emoji}`} disabled={runtime.busy} onClick={()=>void post(emoji)}>{emoji}</button>)}</div>}
    <nav className="studio-media-dock participant-media-dock" aria-label="Controles de participación">
      <div className="studio-dock-split"><button aria-label={mic?'Silenciar micrófono':'Activar micrófono'} aria-pressed={mic} title={mic?'Silenciar micrófono':'Activar micrófono'} disabled={media.zoomPending||media.pending} onClick={()=>toggle('mic')}><LiveIcon name={mic?'mic':'micOff'}/></button><button className="studio-device-chevron" aria-label="Configurar audio" onClick={()=>setAudio(true)}><LiveIcon name="chevron"/></button></div>
      <button aria-label={camera?'Apagar cámara':'Activar cámara'} aria-pressed={camera} title={camera?'Apagar cámara':'Activar cámara'} disabled={media.zoomPending||media.pending} onClick={()=>toggle('camera')}><LiveIcon name={camera?'video':'videoOff'}/></button>
      <span className="studio-dock-divider"/><button aria-label="Levantar la mano" title="Solicitar la palabra en el chat del grupo" disabled={!writable||runtime.busy} onClick={()=>void post('✋ Solicito la palabra.')}><LiveIcon name="hand"/><span>Levantar mano</span></button>
      <button aria-label="Reacciones" aria-expanded={reactions} disabled={!writable||!state.moderation.reactions||runtime.busy} onClick={()=>setReactions(!reactions)}><LiveIcon name="smile"/></button>
      <span className="studio-dock-divider"/><button aria-label="Salas" aria-expanded={rooms} title={room?.name||'Ver mi sala asignada'} onClick={()=>setRooms(true)}><LiveIcon name="users"/><span>{room?.name||'Salas'}</span></button><span className="studio-dock-divider"/>
      <button className="studio-leave-control" aria-label="Salir del aula" onClick={onClose}><LiveIcon name="logout"/><span>Salir</span></button>
    </nav>
  </div>{audio&&<StudioAudioSettings onClose={()=>setAudio(false)}/>} {rooms&&<ParticipantRooms onClose={()=>setRooms(false)}/>}</>;
}
