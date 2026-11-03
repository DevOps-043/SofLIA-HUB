import { useCallback, useEffect, useRef, useState } from 'react';
import type { LearningLiveSessionReference } from '../../shared/learning-live-session';
import type { StudioCallControls, StudioCaption, StudioCallDevices } from '../../shared/studio-call';
import type { StudioRoomsStatus } from '../../shared/studio-call';
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
  const scoped=runtime.snapshot?.session_id===props.reference.session_id?runtime:{...runtime,snapshot:null};
  const access = scoped.snapshot ? `${props.reference.organization_slug}:${props.reference.session_id}:${scoped.snapshot.user_id}:${scoped.snapshot.can_manage}` : 'sin-acceso';
  // Un cambio de identidad o rol destruye medios, iframe y grants de la vista anterior.
  return <StudioConnection key={access} {...props} runtime={scoped} />;
}

function StudioConnection({ reference, onClose, onBack, runtime }: ConnectedStudioProps & { runtime: ReturnType<typeof useStudioSession> }) {
  const media = useStudioMedia();
  const [join, setJoin] = useState<ZoomJoin | null>(null);
  const [zoomConnected, setConnected] = useState(false);
  const [zoomPending, setZoomPending] = useState(false);
  const [zoomError, setZoomError] = useState('');
  const [zoomMedia, setZoomMedia] = useState({ mic: false, camera: false });
  const [zoomSharing, setZoomSharing] = useState(false);
  const [callControls, setCallControls] = useState<StudioCallControls>({ camera: false, captions: false, captionsEnabled: false });
  const [caption, setCaption] = useState<StudioCaption | null>(null);
  const [callDeviceList,setCallDeviceList]=useState<StudioCallDevices|null>(null);
  const zoom = useRef<StudioZoomHandle>(null);
  const alive = useRef(true);
  const [programAudio,setProgramAudio]=useState<MediaStream|null>(null);
  useEffect(()=>{
    if(zoomConnected&&join?.provider==='zoom-video')void zoom.current?.setProgramAudio(programAudio).then(ok=>{if(!ok&&alive.current)setZoomError('No se confirmó el audio del programa. Desactívalo y vuelve a activarlo antes de compartir.');});
  },[programAudio,zoomConnected,join?.provider]);
  const roomVisitPending=useRef(false);
  const [roomsStatus,setRoomsStatus]=useState<StudioRoomsStatus|null>(null);
  const academicMembers=new Set(runtime.snapshot?.state.members.map(member=>member.user_id));
  const roomPlan=JSON.stringify(runtime.snapshot?.state.rooms.map(({id,user_ids})=>({id,user_ids:user_ids.filter(user=>academicMembers.has(user)&&runtime.snapshot?.state.moderation.restrictions[user]!=='blocked')}))??[]);
  const canManage=runtime.snapshot?.can_manage??false;
  useEffect(()=>{if(zoomConnected&&canManage&&join?.provider==='zoom-video')zoom.current?.command('sync-rooms',JSON.parse(roomPlan));},[roomPlan,canManage,join?.provider,zoomConnected]);
  async function visitRoom(id:string|null){
    const previous=runtime.snapshot?.state.members.find(member=>member.user_id===runtime.snapshot?.user_id)?.room_id??null;
    if(roomVisitPending.current)return false;roomVisitPending.current=true;
    try{
    if(zoomConnected&&join?.provider==='zoom-video'){
      if(!await zoom.current?.visitRoom(id)){await zoom.current?.visitRoom(previous);setZoomError('No se confirmó el cambio audiovisual de sala. Reintenta cuando el instructor la haya preparado.');return false;}
      if(await runtime.send({type:'presence',room_id:id}))return true;
      await zoom.current?.visitRoom(previous);setZoomError('No se confirmó el cambio académico. Revisa tu sala antes de continuar.');return false;
    }
    return await runtime.send({type:'presence',room_id:id});
    }finally{roomVisitPending.current=false;}
  }
  const refreshCallDevices=useCallback(()=>zoom.current?.command('get-devices'),[]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; void studioCapture.clear().catch(() => console.warn('[Estudio] No se pudieron liberar los vínculos al cerrar.')); }; }, []);
  const authorized = !!runtime.snapshot;
  const stopMedia = media.stop;
  useEffect(() => { if (!authorized) stopMedia(); }, [authorized, stopMedia]);
  async function connectZoom() {
    if (zoomPending || join) return;
    setZoomPending(true); setZoomError('');
    const result = await studioOperation(reference, { type: 'zoom' });
    if (!alive.current) return;
    if (!result.success || !result.zoom) { setZoomError(result.success ? 'Learning no devolvió acceso a la conexión audiovisual.' : result.error); setZoomPending(false); return; }
    media.stop(); setJoin(result.zoom);
  }
  function leave(callback: () => void) { zoom.current?.command('leave'); media.stop(); callback(); }
  const snapshot = runtime.snapshot;
  if (!snapshot) return <section className="learning-workspace"><header className="learning-workspace-toolbar"><button type="button" aria-label="Volver a mis sesiones" onClick={() => leave(onBack)}><LiveIcon name="back" /></button><button type="button" aria-label="Cerrar aula" onClick={() => leave(onClose)}><LiveIcon name="close" /></button></header><div className="learning-workspace-canvas learning-workspace-state" role="region" aria-label="Espacio de la sesión">{runtime.error ? <div className="learning-workspace-status" role="alert"><LiveIcon name="video" /><h2>Tu aula aún no está disponible</h2><p>{runtime.error}</p><button type="button" onClick={() => void runtime.reconnect()}>Reintentar</button></div> : <p className="learning-workspace-status" role="status">Conectando con tu sesión…</p>}</div></section>;
  const zoomStage = join ? <StudioZoomFrame ref={zoom} join={join} participant={!snapshot.can_manage} onMedia={setZoomMedia} onShare={setZoomSharing} onControls={setCallControls} onDevices={setCallDeviceList} onRooms={setRoomsStatus} onCaption={setCaption} onStatus={(connected, error) => { setConnected(connected); setZoomPending(false); if (!connected) { setZoomSharing(false); setCallControls({camera:false,captions:false,captionsEnabled:false}); setCaption(null); setCallDeviceList(null); } if (error) setZoomError(error); }} /> : null;
  return <StudioRuntimeContext.Provider value={{ ...runtime, snapshot, reference }}><StudioMediaContext.Provider value={{ ...media, configureProgramAudio:setProgramAudio,programAudioAvailable:join?.provider==='zoom-video',visitRoom,roomsStatus, zoomConnected, zoomPending, connectZoom: () => void connectZoom(), zoomStage, zoomMic: zoomMedia.mic, zoomCamera: zoomMedia.camera, zoomSharing, stopZoomShare: () => zoom.current?.command('stop-share'), muteZoom: () => zoom.current?.command('toggle-mic'), toggleZoomCamera: () => zoom.current?.command('toggle-camera'), callControls, callDevices:callDeviceList, refreshCallDevices, selectCallDevice:(choice)=>zoom.current?.command('select-device',choice), caption, setCaptions: (enabled) => { if (!enabled) setCaption(null); zoom.current?.command('captions', enabled); } }}><div className="studio-connected-root">
    {(runtime.error || zoomError || media.error) && <div className="studio-runtime-error" role="alert">{runtime.error || zoomError || media.error}<button onClick={() => { setZoomError(''); if (!zoomConnected) setJoin(null); void runtime.reconnect(); }}>Reintentar</button></div>}
    {snapshot.can_manage&&snapshot.state.rooms.length>0&&zoomConnected&&<p role="status" className="studio-muted">{join?.provider!=='zoom-video'?'Las salas académicas están preparadas. Gestiona el audio y video desde la llamada.':roomsStatus?.status==='ready'?'Salas de audio y video preparadas.':roomsStatus?.status==='unavailable'?'Esta cuenta no tiene habilitadas las salas de audio y video.':roomsStatus?.missing?`Esperando la conexión audiovisual de ${roomsStatus.missing} participantes.`:'Preparando salas de audio y video…'}</p>}
    {snapshot.can_manage ? <InstructorStudio title={snapshot.title} instructorName={snapshot.state.members.find((member) => member.user_id === snapshot.user_id)?.name || 'Instructor'} onClose={() => leave(onClose)} onBack={() => leave(onBack)} /> : <ParticipantStudio onClose={() => leave(onClose)} onBack={() => leave(onBack)} />}
  </div></StudioMediaContext.Provider></StudioRuntimeContext.Provider>;
}
