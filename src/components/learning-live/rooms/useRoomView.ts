import { useState } from 'react';

export type RoomView = 'video' | 'chat' | 'activity' | 'both';

export function useRoomView(compact: boolean) {
  const [selection, setSelection] = useState<RoomView>();
  const [expanded, setExpanded] = useState(false);
  const view = selection ?? (compact ? 'video' : 'both');

  function select(next: RoomView) {
    setSelection(next);
    if (next === 'video') setExpanded(false);
  }

  return {
    view,
    select,
    expanded,
    toggleExpanded: () => setExpanded(previous => !previous),
    chat: view === 'chat' || view === 'both',
    activity: view === 'activity' || view === 'both',
  };
}
