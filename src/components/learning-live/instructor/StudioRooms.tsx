import { LiveIcon } from '../LiveIcon';
import { StudioDialog } from './StudioDialog';
import type { StudioRoom } from './studio-types';

export function StudioRooms({ rooms, activeRoom, participants, onVisit, onClose }: {
  rooms: StudioRoom[]; activeRoom: StudioRoom | null; participants: number; onVisit: (id: string | null) => void; onClose: () => void;
}) {
  function visit(id: string | null) { onVisit(id); onClose(); }
  return <StudioDialog title="Grupo y salas" onClose={onClose}><p className="studio-muted">Visita una sala para acompañar la práctica y dar retroalimentación.</p><div className="studio-room-destinations"><article className={!activeRoom ? 'is-current' : ''}><span className="studio-room-symbol"><LiveIcon name="users" /></span><div><strong>Grupo principal</strong><small>{participants} participantes · sesión completa</small></div><button disabled={!activeRoom} aria-label={activeRoom ? 'Volver al grupo principal' : 'Ya estás en el grupo principal'} onClick={() => visit(null)}>{activeRoom ? 'Volver' : 'Estás aquí'}</button></article>
    {rooms.map((room) => <article className={activeRoom?.id === room.id ? 'is-current' : ''} key={room.id}><span className="studio-room-symbol"><LiveIcon name="users" /></span><div><strong>{room.name}</strong><small>{room.participants} participantes · práctica</small></div><button disabled={activeRoom?.id === room.id} aria-label={activeRoom?.id === room.id ? `Ya estás en ${room.name}` : `Entrar a ${room.name}`} onClick={() => visit(room.id)}>{activeRoom?.id === room.id ? 'Estás aquí' : 'Entrar'}</button></article>)}</div>
    {!rooms.length && <p className="studio-rooms-empty">Aún no tienes salas. Prepáralas desde Salas de práctica.</p>}<p className="studio-room-design-note">Cambio de vista local · sin traslado real en Zoom</p>
  </StudioDialog>;
}
