import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { ZoomJoin } from '../../../shared/live-studio.contract';
import { studioRoomsStatusSchema,type StudioRoomsStatus } from '../../../shared/studio-call';
import {StudioProgramAudioSender} from '../../../services/studio-program-audio';
import { studioCallControlsSchema, studioCaptionSchema, studioCallDevicesSchema, type StudioCallDevices, type StudioCallCommand, type StudioCallControls, type StudioCaption } from '../../../shared/studio-call';
import { studioCallVisualSchema, studioRecordingStatusSchema, type StudioCallVisual, type StudioRecordingStatus } from '../../../shared/studio-call';

export type StudioZoomHandle = { command: (type: StudioCallCommand, detail?: unknown) => void; visitRoom:(id:string|null)=>Promise<boolean>;setProgramAudio:(stream:MediaStream|null)=>Promise<boolean> };
export const StudioZoomFrame = forwardRef<StudioZoomHandle, { join: ZoomJoin; onStatus: (connected: boolean, error?: string) => void; onMedia: (media: { mic: boolean; camera: boolean }) => void; onShare: (sharing: boolean) => void; onControls?: (controls: StudioCallControls) => void; onCaption?: (caption: StudioCaption) => void; onDevices?: (devices: StudioCallDevices) => void; onRooms?:(state:StudioRoomsStatus)=>void; onVisual?: (state: StudioCallVisual) => void; onRecording?: (status: StudioRecordingStatus) => void; participant?: boolean }>(function StudioZoomFrame({ join, onStatus, onMedia, onShare, onControls, onCaption, onDevices, onRooms, onVisual, onRecording, participant = false }, handle) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [nonce] = useState(() => crypto.randomUUID());
  const callbacks = useRef({ onStatus, onMedia, onShare, onControls, onCaption, onDevices, onVisual, onRecording }); callbacks.current = { onStatus, onMedia, onShare, onControls, onCaption, onDevices, onVisual, onRecording };
  const roomRequests=useRef(new Map<string,{resolve:(ok:boolean)=>void;timer:number}>());
  const roomsCallback=useRef(onRooms);roomsCallback.current=onRooms;
  const credentials = useRef(join);
  const targetOrigin = window.learningLive?.sdkFrameUrl ? 'soflia-zoom://meeting' : location.protocol === 'file:' ? '*' : location.origin;
  const url = window.learningLive?.sdkFrameUrl ? `${window.learningLive.sdkFrameUrl}#${nonce}` : import.meta.env.DEV ? `/packages/zoom-runtime/index.html#${nonce}` : `./zoom-runtime/index.html#${nonce}`;
  const audioSender=useRef<StudioProgramAudioSender|null>(null);
  if(!audioSender.current)audioSender.current=new StudioProgramAudioSender((type,detail)=>frame.current?.contentWindow?.postMessage({source:'soflia-studio',nonce,type,detail},targetOrigin),()=>callbacks.current.onStatus(true,"El audio del programa se interrumpió. Detén compartir y vuelve a prepararlo."));
  useImperativeHandle(handle, () => ({ setProgramAudio:stream=>audioSender.current!.set(stream), command: (type, detail) => frame.current?.contentWindow?.postMessage({ source: 'soflia-studio', nonce, type, detail }, targetOrigin), visitRoom:(id)=>new Promise<boolean>(resolve=>{
    const request=crypto.randomUUID();
    const timer=window.setTimeout(()=>{roomRequests.current.delete(request);resolve(false);},20000);
    roomRequests.current.set(request,{resolve,timer});
    frame.current?.contentWindow?.postMessage({source:'soflia-studio',nonce,type:'visit-room',detail:{room_id:id,request_id:request}},targetOrigin);
  }) }), [nonce, targetOrigin]);
  useEffect(() => {
    const frameWindow = frame.current?.contentWindow;
    const pendingRooms=roomRequests.current,audio=audioSender.current;
    let ready = false;
    const timeout = window.setTimeout(() => { if (!ready) callbacks.current.onStatus(false, 'No se pudo cargar la conexión audiovisual. Reintenta entrar a la sesión.'); }, 20000);
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== (targetOrigin === '*' ? 'null' : targetOrigin)) return;
      const message = event.data;
      if (!message || message.source !== 'soflia-zoom' || message.nonce !== nonce) return;
      if (message.type === 'ready') { ready = true; window.clearTimeout(timeout); frame.current?.contentWindow?.postMessage({ source: 'soflia-studio', nonce, type: 'join', detail: credentials.current, presentation: participant ? 'participant' : 'instructor' }, targetOrigin); }
      else if(message.type==='program-audio-answer'&&typeof message.detail?.id==='string')audioSender.current?.accept(message.detail.id,message.detail.answer);
      else if(message.type==='rooms-status'){const result=studioRoomsStatusSchema.safeParse(message.detail);if(result.success)roomsCallback.current?.(result.data);}
      else if(message.type==='room-joined'&&typeof message.detail?.request_id==='string'){
        const request=roomRequests.current.get(message.detail.request_id);
        if(request){window.clearTimeout(request.timer);roomRequests.current.delete(message.detail.request_id);request.resolve(true);}
      }
      else if (message.type === 'connected') callbacks.current.onStatus(true);
      else if (message.type === 'disconnected') callbacks.current.onStatus(false);
      else if (message.type === 'error') callbacks.current.onStatus(false, 'No se pudo completar la acción. Revisa los permisos de anfitrión y el ingreso a la sesión.');
      else if (message.type === 'action-error') callbacks.current.onStatus(true, 'No se pudo completar la acción. Usa los controles de la llamada para revisar el estado de la sesión.');
      else if (message.type === 'call-controls') { const parsed = studioCallControlsSchema.safeParse(message.detail); if (parsed.success) callbacks.current.onControls?.(parsed.data); }
      else if (message.type === 'call-devices') { const parsed=studioCallDevicesSchema.safeParse(message.detail); if(parsed.success)callbacks.current.onDevices?.(parsed.data); }
      else if (message.type === 'caption') { const parsed = studioCaptionSchema.safeParse(message.detail); if (parsed.success) callbacks.current.onCaption?.(parsed.data); }
      else if (message.type === 'visual') { const parsed = studioCallVisualSchema.safeParse(message.detail); if (parsed.success) callbacks.current.onVisual?.(parsed.data); }
      else if (message.type === 'recording') { const parsed = studioRecordingStatusSchema.safeParse(message.detail); if (parsed.success) callbacks.current.onRecording?.(parsed.data); }
      else if (message.type === 'media' && typeof message.detail?.mic === 'boolean' && typeof message.detail?.camera === 'boolean') callbacks.current.onMedia(message.detail);
      else if (message.type === 'recording-error') callbacks.current.onStatus(true,'No se confirmó el inicio de la grabación. Revisa la configuración de la cuenta de Soflia.');
      else if (message.type === 'sharing' && typeof message.detail === 'boolean') callbacks.current.onShare(message.detail);
    }
    window.addEventListener('message', receive);
    return () => { audio?.close(); for(const request of pendingRooms.values()){window.clearTimeout(request.timer);request.resolve(false);}pendingRooms.clear(); window.clearTimeout(timeout); window.removeEventListener('message', receive); frameWindow?.postMessage({ source: 'soflia-studio', nonce, type: 'leave' }, targetOrigin); };
  }, [nonce, targetOrigin, participant]);
  return <iframe ref={frame} className="studio-zoom-frame" title="Sesión audiovisual integrada" src={url} sandbox="allow-scripts allow-same-origin allow-forms" allow="camera; microphone; display-capture; autoplay; fullscreen" />;
});
