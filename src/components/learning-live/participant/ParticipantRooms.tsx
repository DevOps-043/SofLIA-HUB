import { useRoomVisit } from '../rooms/useRoomVisit';
import { LiveIcon } from '../LiveIcon';
import { StudioDialog } from '../instructor/StudioDialog';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';

export function ParticipantRooms({onClose}:{onClose:()=>void}) {
  const runtime=useStudioRuntime()!;
  const {visit:visitRoom,visiting,error}=useRoomVisit();
  const {state,user_id}=runtime.snapshot;
  const assigned=state.rooms.filter(room=>room.user_ids.includes(user_id));
  const current=state.members.find(member=>member.user_id===user_id)?.room_id??null;

  async function visit(room_id:string|null) { const ok=await visitRoom(room_id); if(ok) onClose(); }
  return <StudioDialog title="Tus salas" onClose={onClose}><p className="studio-muted">Entra a la sala de tu equipo. Cuando la llamada lo permite, el audio y video cambian junto con tu conversación.</p><div className="participant-room-list">
    <article><LiveIcon name="users" /><div><strong>Grupo principal</strong><small>Conversación de la clase</small></div><button disabled={visiting||runtime.busy||!current} onClick={()=>void visit(null)}>{current?'Volver':'Estás aquí'}</button></article>
    {assigned.map(room=><article key={room.id}><LiveIcon name="users"/><div><strong>{room.name}</strong><small>{runtime.snapshot.rooms_version===1?`${room.user_ids.length} participantes`:'Tu sala asignada'}</small></div><button disabled={visiting||runtime.busy||current===room.id} onClick={()=>void visit(room.id)}>{current===room.id?'Estás aquí':'Entrar'}</button></article>)}
    {!assigned.length&&<p>El instructor aún no te ha asignado una sala.</p>}
  </div>{error&&<p role="alert">{error}</p>}</StudioDialog>;
}
