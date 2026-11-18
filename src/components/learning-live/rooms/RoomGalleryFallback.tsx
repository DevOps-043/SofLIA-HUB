import { LiveIcon } from '../LiveIcon';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';
import { useStudioMediaRuntime } from '../instructor/StudioMediaContext';
import { useRoomVisit } from './useRoomVisit';

export function RoomGalleryFallback({ roomId }: { roomId: string }) {
  const { snapshot } = useStudioRuntime()!;
  const media = useStudioMediaRuntime();
  const { visit, visiting, error } = useRoomVisit();
  const present = snapshot.state.members.filter(member => member.room_id === roomId);
  const canReconnect = media?.zoomConnected && media.programAudioAvailable;

  return <div className="room-gallery-fallback">
    <header>
      <p>{media?.zoomPending ? 'Conectando audio y video…' : canReconnect ? 'Falta confirmar la conexión audiovisual de esta sala.' : media?.zoomConnected ? 'La llamada administra sus salas de audio y video por separado.' : 'Presencia en la sala · audio y video sin conectar'}</p>
      {canReconnect && <button className="room-secondary" disabled={visiting} onClick={() => void visit(roomId)}>{visiting ? 'Entrando…' : 'Entrar al audio y video de la sala'}</button>}
      {error && <p role="alert">{error}</p>}
    </header>
    {present.length ? <ul className="room-gallery-people" aria-label="Personas presentes en la sala">
      {present.map(member => <li key={member.user_id}>
        <span aria-hidden="true" className="room-gallery-initial">{member.name.slice(0, 1).toLocaleUpperCase()}</span>
        <strong>{member.name}{member.user_id === snapshot.user_id && ' (tú)'}</strong>
        {member.instructor && <small>Instructor</small>}
      </li>)}
    </ul> : <p className="room-gallery-empty"><LiveIcon name="users" />No hay personas presentes en esta sala.</p>}
  </div>;
}
