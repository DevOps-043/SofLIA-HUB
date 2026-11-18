import { useEffect, useRef, useState } from 'react';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';
import { useStudioMediaRuntime } from '../instructor/StudioMediaContext';

export function useRoomVisit() {
  const runtime = useStudioRuntime()!;
  const media = useStudioMediaRuntime();
  const pending = useRef(false), alive = useRef(true);
  const [visiting, setVisiting] = useState(false), [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function visit(roomId: string | null) {
    if (pending.current || runtime.busy) return false;
    pending.current = true; setVisiting(true); setError('');
    try {
      const ok = media?.visitRoom ? await media.visitRoom(roomId) : await runtime.send({ type: 'presence', room_id: roomId });
      if (!ok && alive.current) setError('No se confirmó el cambio de sala. Conservas tu ubicación anterior; vuelve a intentarlo.');
      return ok;
    } catch {
      if (alive.current) setError('No se pudo cambiar de sala. Vuelve a intentarlo.');
      return false;
    } finally {
      pending.current = false;
      if (alive.current) setVisiting(false);
    }
  }
  return { visit, visiting, error };
}
