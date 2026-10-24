import { useEffect, useRef, useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioSceneCanvas } from '../instructor/StudioSceneCanvas';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';
import { useStudioMediaRuntime } from '../instructor/StudioMediaContext';

export function ParticipantStage() {
  const {snapshot}=useStudioRuntime()!;
  const media=useStudioMediaRuntime()!;
  const root=useRef<HTMLElement>(null);
  const [full,setFull]=useState(false),[notice,setNotice]=useState('');
  const scene=snapshot.state.scenes.find(item=>item.id===snapshot.state.active_scene_id);
  const caption=media.caption;
  useEffect(()=>{
    const element=root.current;
    const changed=()=>setFull(document.fullscreenElement===element);
    document.addEventListener('fullscreenchange',changed);
    return()=>{document.removeEventListener('fullscreenchange',changed);if(document.fullscreenElement===element) void document.exitFullscreen().catch(()=>{});};
  },[]);
  async function fullscreen() { try { if(document.fullscreenElement===root.current) await document.exitFullscreen(); else await root.current?.requestFullscreen();setNotice(''); } catch {setNotice('No se pudo abrir pantalla completa. Vuelve a intentarlo.');} }
  function captions() {
    if(!media.zoomConnected){setNotice('Únete a la sesión para activar los subtítulos.');return;}
    if(!media.callControls?.captions){setNotice('Los subtítulos no están habilitados en esta llamada. Solicita al instructor que los active desde sus controles.');return;}
    media.setCaptions?.(!media.callControls.captionsEnabled);setNotice('');
  }
  return <section ref={root} className="participant-stage" aria-label="Escenario de la clase">
    <div className="participant-stage-content">{media.zoomStage|| (scene?<StudioSceneCanvas key={scene.id} scene={{...scene,assetUrl:scene.asset_path?snapshot.asset_urls[scene.asset_path]:undefined}}/>:<div className="participant-stage-empty"><LiveIcon name="video"/><h2>Tu próxima idea empieza aquí</h2><p>{media.zoomConnected?'Esperando la transmisión del instructor.':'Únete a la sesión para ver y escuchar la clase.'}</p></div>)}</div>
    {media.callControls?.captionsEnabled&&caption&&<div className="participant-caption" key={caption.text+caption.speaker} role="status"><strong>{caption.speaker}</strong><span>{caption.text}</span></div>}
    <div className="participant-stage-bar"><span><i className={media.zoomConnected?'is-connected':''}/>{media.zoomConnected?'Sesión conectada':scene?'Contenido de la sesión':'Vista de la clase'}</span><div><button aria-label={media.callControls?.captionsEnabled?'Desactivar subtítulos':'Activar subtítulos automáticos'} aria-pressed={!!media.callControls?.captionsEnabled} title="Subtítulos automáticos" onClick={captions}><LiveIcon name="captions"/></button><button aria-label={full?'Salir de pantalla completa':'Ver presentación en pantalla completa'} onClick={()=>void fullscreen()}><LiveIcon name="fullscreen"/></button></div></div>
    {notice&&<p className="participant-stage-notice" role="status">{notice}</p>}
  </section>;
}
