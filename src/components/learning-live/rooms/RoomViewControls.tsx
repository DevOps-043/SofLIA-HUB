import { LiveIcon, type LiveIconName } from '../LiveIcon';
import type { RoomView, useRoomView } from './useRoomView';

const choices = [
  { id: 'video', label: 'Solo video', icon: 'video' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'activity', label: 'Actividad', icon: 'file' },
  { id: 'both', label: 'Ambos', icon: 'grid' },
] as const satisfies ReadonlyArray<{ id: RoomView; label: string; icon: LiveIconName }>;

export function RoomViewControls({ view, select, expanded, toggleExpanded }: ReturnType<typeof useRoomView>) {
  return <nav className="room-view-controls" aria-label="Vista de la sala">
    <div className="room-view-options" role="group" aria-label="Contenido visible">
      {choices.map(choice => <button key={choice.id} type="button" aria-pressed={view === choice.id} onClick={() => select(choice.id)}>
        <LiveIcon name={choice.icon} />{choice.label}
      </button>)}
    </div>
    {view !== 'video' && <button type="button" className="room-view-expand" onClick={toggleExpanded}>
      <LiveIcon name={expanded ? 'video' : 'fullscreen'} />{expanded ? 'Mostrar video' : 'Ampliar lateral'}
    </button>}
  </nav>;
}
