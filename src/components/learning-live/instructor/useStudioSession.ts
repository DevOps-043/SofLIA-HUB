import { useCallback, useEffect, useRef, useState } from 'react';
import type { LearningLiveSessionReference } from '../../../shared/learning-live-session';
import type { StudioCommand, StudioSnapshot } from '../../../shared/live-studio.contract';
import { onStudioInvalidation, studioCommand, studioOperation, uploadStudioFile } from '../../../services/live-studio-service';
import { StudioAssetUrls } from '../../../services/studio-asset-urls';

export function useStudioSession(reference: LearningLiveSessionReference) {
  const slug = reference.organization_slug, session = reference.session_id;
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null);
  const [error, setError] = useState('');
  const [readError,setReadError]=useState('');
  const [busy, setBusy] = useState(false);
  const [realtime, setRealtime] = useState('Conectando Realtime');
  const current = useRef<StudioSnapshot | null>(null);
  const epoch = useRef(0);
  const commandPending = useRef(false);
  const reading = useRef(false);
  const dirty = useRef(false);
  const watching = useRef(false);
  const reconnecting=useRef(false);
  const assets = useRef(new StudioAssetUrls());
  const refresh = useCallback(async () => {
    if (reading.current) { dirty.current = true; return; }
    reading.current = true;
    const generation = epoch.current;
    try {
      do {
        dirty.current = false;
        const result = await studioOperation({ organization_slug: slug, session_id: session }, { type: 'snapshot' });
        if (generation !== epoch.current) return;
        if (!result.success || !result.snapshot) {
          setReadError(result.success ? 'Learning no devolvió el estado del estudio.' : result.error);
          if (!result.success && ['not_ready', 'access_denied'].includes(result.code)) { current.current = null; setSnapshot(null); }
          return;
        }
        setReadError('');
        if (!current.current || result.snapshot.state.revision >= current.current.state.revision) { current.current = assets.current.normalize(result.snapshot, Date.now()); setSnapshot(current.current); }
      } while (dirty.current);
    } finally { if (generation === epoch.current) reading.current = false; }
  }, [slug, session]);
  const subscribe = useCallback(async () => {
    if(watching.current)return;
    if(!current.current){setRealtime('Realtime no disponible');return;}
    watching.current=true;
    const generation=epoch.current;
    try {
      setRealtime('Conectando Realtime');
      const result=await window.learningLive?.watchStudio?.({organization_slug:slug,session_id:session});
      if(generation===epoch.current&&!result?.success)setRealtime('Realtime no disponible');
    } catch { if(generation===epoch.current)setRealtime('Realtime no disponible'); }
    finally { if(generation===epoch.current)watching.current=false; }
  },[slug,session]);
  const send = useCallback(async (command: StudioCommand) => {
    if (!current.current || commandPending.current) return false;
    const generation = epoch.current;
    commandPending.current = true; setBusy(true); setError('');
    try {
      const result = await studioCommand({ organization_slug: slug, session_id: session }, current.current.state.revision, command);
      if (generation !== epoch.current) return false;
      if (!result.success || !result.snapshot) {
        if (result.success || result.code !== 'conflict' || command.type !== 'presence') setError(result.success ? 'Learning no confirmó la acción.' : result.error);
        await refresh(); return false;
      }
      if (!current.current || result.snapshot.state.revision >= current.current.state.revision) { current.current = assets.current.normalize(result.snapshot, Date.now()); setSnapshot(current.current); }
      return true;
    } finally { if (generation === epoch.current) { commandPending.current = false; setBusy(false); } }
  }, [slug, session, refresh]);
  const reconnect=useCallback(async()=>{
    if(reconnecting.current||watching.current)return;
    reconnecting.current=true;const generation=epoch.current;setError('');
    try{
      await refresh();if(generation!==epoch.current)return;
      await subscribe();if(generation!==epoch.current||!current.current)return;
      const room_id=current.current.state.members.find(member=>member.user_id===current.current?.user_id)?.room_id??null;
      await send({type:'presence',room_id});
    } finally{if(generation===epoch.current)reconnecting.current=false;}
  },[refresh,subscribe,send]);
  useEffect(() => {
    epoch.current++; current.current = null; reading.current = false; commandPending.current = false; watching.current=false; reconnecting.current=false; assets.current.clear();
    const generation = epoch.current;
    let disposed = false;
    const stop = onStudioInvalidation(session, (status) => {
      if (disposed) return;
      if (status !== 'changed') setRealtime(status === 'connected' ? 'Realtime conectado' : 'Realtime desconectado');
      if (status !== 'disconnected') void refresh();
    });
    void refresh().then(async () => {
      if (disposed) return;
      await subscribe();
      if(disposed)return;
      await send({ type: 'presence', room_id: null });
    });
    // Lease de presencia; no sondeo de chat. Se serializa con acciones del usuario.
    const heartbeat = window.setInterval(() => {
      if (!disposed && current.current && !commandPending.current) {
        const room_id = current.current.state.members.find((member) => member.user_id === current.current?.user_id)?.room_id ?? null;
        void send({ type: 'presence', room_id });
      }
    }, 30000);
    return () => { disposed = true; epoch.current = generation + 1; stop(); window.clearInterval(heartbeat); void window.learningLive?.unwatchStudio?.(); };
  }, [slug, session, refresh, send, subscribe]);
  return { snapshot, error:readError||error, busy, realtime, send, reconnect, refresh: () => { setError(''); return refresh(); }, upload: (file: File) => uploadStudioFile(reference, file) };
}
