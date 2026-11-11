import { useCallback, useEffect, useRef, useState } from 'react';
import { StudioProgramRenderer, createMediaProgramSource, createTextProgramSource, type ProgramSource } from '../../../services/studio-program-renderer';
import { connectProgramOutput } from '../../../services/studio-output';
import { studioCapture } from '../../../services/studio-capture';
import type { StudioPreparedScene } from './studio-types';

export function useStudioProgram(onAudio?:(stream:MediaStream|null)=>void,sharing=false) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bindCanvas = useCallback((element: HTMLCanvasElement | null) => { canvas.current = element; }, []);
  const renderer = useRef<StudioProgramRenderer | null>(null);
  const connection = useRef<((closeRemote?: boolean) => void) | null>(null);
  const preparation = useRef<AbortController | null>(null);
  const epoch = useRef(0), busy = useRef(false), alive = useRef(false);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const [state, setState] = useState<'idle' | 'preparing' | 'ready'>('idle');
  const [programScene, setProgramScene] = useState<StudioPreparedScene | null>(null);
  const [cameraOverlay,setCameraOverlay]=useState(false),[cameraPending,setCameraPending]=useState(false),[audioEnabled,setAudioEnabled]=useState(false),[label,setLabel]=useState('');
  const audioCallback=useRef(onAudio);audioCallback.current=onAudio;
  const cameraGeneration=useRef(0),cameraBusy=useRef(false);
  const pendingCamera=useRef<{stream:MediaStream;abort:AbortController}|null>(null);
  const fail = () => { if (alive.current) setError('No se pudo componer la salida. Revisa la fuente antes de continuar.'); };
  function invalidate() { epoch.current++; }
  function invalidateCamera(){cameraGeneration.current++;pendingCamera.current?.abort.abort();pendingCamera.current?.stream.getTracks().forEach(track=>track.stop());pendingCamera.current=null;}
  useEffect(() => {
    alive.current = true;
    if (canvas.current) renderer.current = new StudioProgramRenderer(canvas.current, fail);
    const off = window.studioOutput?.onState((notice) => {
      if (!alive.current) return;
      if (notice.state === 'ready') setState('ready');
      else { reset(false); if (notice.state === 'error') setError('La salida se interrumpió. Vuelve a prepararla antes de compartir.'); }
    });
    return () => { alive.current = false;invalidateCamera();audioCallback.current?.(null); invalidate(); preparation.current?.abort(); preparation.current = null; off?.(); connection.current?.(); connection.current = null; void window.studioOutput?.close(); renderer.current?.close(); renderer.current = null; };
    // El ciclo de vida es el del estudio, no el de cada render o escena seleccionada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function reset(close = true) {
    epoch.current++; busy.current = false;
    invalidateCamera();cameraBusy.current=false;setCameraPending(false);setCameraOverlay(false);setAudioEnabled(false);setLabel('');audioCallback.current?.(null);
    preparation.current?.abort(); preparation.current = null;
    connection.current?.(close); connection.current = null;
    renderer.current?.close(); renderer.current = canvas.current ? new StudioProgramRenderer(canvas.current, fail) : null;
    if (alive.current) { setPending(false); setState('idle'); setProgramScene(null); }
  }
  async function source(scene: StudioPreparedScene, current: () => boolean, signal: AbortSignal): Promise<ProgramSource> {
    if (scene.kind === 'holding' || scene.kind === 'slide') return createTextProgramSource(scene);
    if (scene.kind === 'screen') {
      if (!scene.capture) throw new Error('Vincula la fuente antes de pasarla a salida.');
      await studioCapture.activate(scene.capture.id, true);
      if (!current()) throw new Error('La preparación se canceló.');
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (!current()) { stream.getTracks().forEach((track) => track.stop()); throw new Error('La preparación se canceló.'); }
      return createMediaProgramSource(scene, stream, signal);
    }
    if (!scene.assetUrl) throw new Error('El archivo de esta escena ya no está disponible.');
    return createMediaProgramSource(scene, undefined, signal);
  }
  async function take(scene: StudioPreparedScene, prepare = false) {
    if (busy.current || !renderer.current || !prepare && state === 'idle') return;
    busy.current = true; setPending(true); setError('');
    const generation = epoch.current, compositor = renderer.current;
    const controller = new AbortController(); preparation.current = controller;
    let next: ProgramSource | null = null;
    const current = () => alive.current && generation === epoch.current && renderer.current === compositor;
    try {
      next = await source(scene, current, controller.signal);
      if (!current()) { next.close(); return; }
      const change = compositor.take(next, { effect: 'cut', durationMs: 100 }); next = null;
      await change;
      if (!current()) return;
      setProgramScene(scene);
      if (prepare) {
        setState('preparing');
        const close = await connectProgramOutput(compositor.capture(), current);
        if (!current()) { close(); return; }
        connection.current = close;
      }
      return true;
    } catch (cause) {
      next?.close();
      if (current()) { if (prepare) reset(); setError(cause instanceof Error ? cause.message : 'No se pudo preparar la escena.'); }
    } finally { if (preparation.current === controller) preparation.current = null; if (current()) { busy.current = false; setPending(false); } }
  }
  async function toggleCamera(){
    if(cameraBusy.current||!renderer.current||state==='idle')return;
    if(cameraOverlay){cameraGeneration.current++;renderer.current.setOverlay(null);setCameraOverlay(false);return;}
    cameraBusy.current=true;setCameraPending(true);setError('');
    const generation=++cameraGeneration.current,compositor=renderer.current;
    let source:ProgramSource|null=null;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360}},audio:false});
      if(!alive.current||generation!==cameraGeneration.current){stream.getTracks().forEach(track=>track.stop());return;}
      const abort=new AbortController();pendingCamera.current={stream,abort};
      source=await createMediaProgramSource({id:'program-camera',name:'Cámara',kind:'screen',title:'',description:''},stream,abort.signal);
      if(!alive.current||generation!==cameraGeneration.current){source.close();return;}
      pendingCamera.current=null;compositor.setOverlay(source);source=null;setCameraOverlay(true);
    }catch{source?.close();if(alive.current&&generation===cameraGeneration.current)setError('No se pudo añadir la cámara al programa. Revisa sus permisos o si el dispositivo está ocupado.');}
    finally{if(generation===cameraGeneration.current){pendingCamera.current=null;cameraBusy.current=false;setCameraPending(false);}}
  }
  async function toggleAudio(){
    const compositor=renderer.current,generation=epoch.current;if(!compositor||state==='idle'||sharing)return;
    try{
      const stream=await compositor.setAudioEnabled(!audioEnabled);
      if(!alive.current||generation!==epoch.current)return;
      setAudioEnabled(!audioEnabled);audioCallback.current?.(stream);
    }catch{if(alive.current)setError('No se pudo preparar el audio del programa.');}
  }
  function updateLabel(text:string){setLabel(text);renderer.current?.setLabel(text);}
  return { bindCanvas, state, pending, error, programScene, take, cameraOverlay,cameraPending,audioEnabled,label,toggleCamera,toggleAudio,updateLabel, stop: () => reset() };
}
