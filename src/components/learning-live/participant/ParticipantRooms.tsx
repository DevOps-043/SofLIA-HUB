import { useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioDialog } from '../instructor/StudioDialog';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';

export function ParticipantRooms({onClose}:{onClose:()=>void}) {
  const runtime=useStudioRuntime()!;
  const {state,user_id}=runtime.snapshot;
  const assigned=state.rooms.filter(room=>room.user_ids.includes(user_id));
  const current=state.members.find(member=>member.user_id===user_id)?.room_id??null;
  const [notice,setNotice]=useState('');
  async function visit(room_id:string|null) { const ok=await runtime.send({type:'presence',room_id}); if(ok) onClose(); else setNotice('No pudimos cambiar de sala. Reintenta.'); }
  return <StudioDialog title="Tus salas" onClose={onClose}><p className="studio-muted">Cambia el chat para trabajar con tu equipo. El audio y video se administran desde la llamada.</p><div className="participant-room-list">
    <article><LiveIcon name="users" /><div><strong>Grupo principal</strong><small>Conversación de la clase</small></div><button disabled={runtime.busy||!current} onClick={()=>void visit(null)}>{current?'Volver':'Estás aquí'}</button></article>
    {assigned.map(room=><article key={room.id}><LiveIcon name="users"/><div><strong>{room.name}</strong><small>{room.user_ids.length} participantes</small></div><button disabled={runtime.busy||current===room.id} onClick={()=>void visit(room.id)}>{current===room.id?'Estás aquí':'Entrar'}</button></article>)}
    {!assigned.length&&<p>El instructor aún no te ha asignado una sala.</p>}
  </div>{notice&&<p role="alert">{notice}</p>}</StudioDialog>;
}
