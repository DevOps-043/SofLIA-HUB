import { useEffect, useRef, useState } from 'react';
import type { LearningLiveSessionReference } from '../../shared/learning-live-session';
import type { ZoomJoin } from '../../shared/live-studio.contract';
import { studioOperation } from '../../services/live-studio-service';
import { InstructorStudio } from './instructor/InstructorStudio';
import { useStudioSession } from './instructor/useStudioSession';
import { StudioRuntimeContext } from './instructor/StudioRuntimeContext';
import { StudioMediaContext } from './instructor/StudioMediaContext';
import { useStudioMedia } from './instructor/useStudioMedia';
import { StudioZoomFrame, type StudioZoomHandle } from './instructor/StudioZoomFrame';
import { ParticipantStudio } from './ParticipantStudio';
import { LiveIcon } from './LiveIcon';
import { studioCapture } from '../../services/studio-capture';
import './instructor/studio-runtime.css';

type ConnectedStudioProps = { reference: LearningLiveSessionReference; onClose: () => void; onBack: () => void };
export function ConnectedStudio(props: ConnectedStudioProps) {
  const runtime = useStudioSession(props.reference);
  const access = runtime.snapshot ? `${runtime.snapshot.user_id}:${runtime.snapshot.can_manage}` : 'sin-acceso';
  // Un cambio de identidad o rol destruye medios, iframe y grants de la vista anterior.
  return <StudioConnection key={access} {...props} runtime={runtime} />;
}

function StudioConnection({ reference, onClose, onBack, runtime }: ConnectedStudioProps & { runtime: ReturnType<typeof useStudioSession> }) {
  const media = useStudioMedia();
  const [join, setJoin] = useState<ZoomJoin | null>(null);
  const [zoomConnected, setConnected] = useState(false);
  const [zoomPending, setZoomPending] = useState(false);
  const [zoomError, setZoomError] = useState('');
  const [zoomMedia, setZoomMedia] = useState({ mic: false, camera: false });
  const [zoomSharing, setZoomSharing] = useState(false);
  const zoom = useRef<StudioZoomHandle>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; void studioCapture.clear().catch(() => console.warn('[Estudio] No se pudieron liberar los vínculos al cerrar.')); }; }, []);
  const authorized = !!runtime.snapshot;
  const stopMedia = media.stop;
  useEffect(() => { if (!authorized) stopMedia(); }, [authorized, stopMedia]);
  async function connectZoom() {
    if (zoomPending || join) return;
    setZoomPending(true); setZoomError('');
    const result = await studioOperation(reference, { type: 'zoom' });
    if (!alive.current) return;
    if (!result.success || !result.zoom) { setZoomError(result.success ? 'Learning no devolvió acceso a Zoom.' : result.error); setZoomPending(false); return; }
    media.stop(); setJoin(result.zoom);
  }
  function leave(callback: () => void) { zoom.current?.command('leave'); media.stop(); callback(); }
  const snapshot = runtime.snapshot;
  if (!snapshot) return <section className="learning-workspace"><header className="learning-workspace-toolbar"><button type="button" aria-label="Volver a mis sesiones" onClick={() => leave(onBack)}><LiveIcon name="back" /></button><button type="button" aria-label="Cerrar aula" onClick={() => leave(onClose)}><LiveIcon name="close" /></button></header><div className="learning-workspace-canvas learning-workspace-state" role="region" aria-label="Espacio de la sesión">{runtime.error ? <div className="learning-workspace-status" role="alert"><LiveIcon name="video" /><h2>Tu aula aún no está disponible</h2><p>{runtime.error}</p><button type="button" onClick={() => void runtime.refresh()}>Reintentar</button></div> : <p className="learning-workspace-status" role="status">Conectando con tu sesión…</p>}</div></section>;
  const zoomStage = join ? <StudioZoomFrame ref={zoom} join={join} onMedia={setZoomMedia} onShare={setZoomSharing} onStatus={(connected, error) => { setConnected(connected); setZoomPending(false); if (!connected) setZoomSharing(false); if (error) setZoomError(error); }} /> : null;
  return <StudioRuntimeContext.Provider value={{ ...runtime, snapshot }}><StudioMediaContext.Provider value={{ ...media, zoomConnected, zoomPending, connectZoom: () => void connectZoom(), zoomStage, zoomMic: zoomMedia.mic, zoomCamera: zoomMedia.camera, zoomSharing, stopZoomShare: () => zoom.current?.command('stop-share'), muteZoom: () => zoom.current?.command('mute', zoomMedia.mic) }}><div className="studio-connected-root">
    {(runtime.error || zoomError || media.error) && <div className="studio-runtime-error" role="alert">{runtime.error || zoomError || media.error}<button onClick={() => { setZoomError(''); if (!zoomConnected) setJoin(null); void runtime.refresh(); }}>Reintentar</button></div>}
    {snapshot.can_manage ? <InstructorStudio title={snapshot.title} instructorName={snapshot.state.members.find((member) => member.user_id === snapshot.user_id)?.name || 'Instructor'} onClose={() => leave(onClose)} onBack={() => leave(onBack)} /> : <ParticipantStudio onClose={() => leave(onClose)} onBack={() => leave(onBack)} />}
  </div></StudioMediaContext.Provider></StudioRuntimeContext.Provider>;
}
