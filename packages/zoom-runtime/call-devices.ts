import { studioDeviceSelectionSchema, type StudioCallDevices } from '../../src/shared/studio-call';
import type { ZoomVideo } from './video-client';

type Stream=ReturnType<ReturnType<typeof ZoomVideo.createClient>['getMediaStream']>;
/** La selección no inicia captura: las fuentes apagadas se aplican al activarlas. */
export function callDevices(stream:Stream, active:()=>{audio:boolean;camera:boolean}, checked:(result:unknown)=>Promise<void>) {
  let input='default',output='default',camera='default';
  function list() : StudioCallDevices {
    const devices=(items:{deviceId:string;label:string}[])=>items.slice(0,50).filter(item=>item.deviceId&&item.deviceId.length<=512).map(item=>({id:item.deviceId,label:item.label.slice(0,160)}));
    const state=active();
    return {microphones:devices(stream.getMicList()),speakers:devices(stream.getSpeakerList()),cameras:devices(stream.getCameraList()),input:state.audio?stream.getActiveMicrophone()||input:input,output:state.audio?stream.getActiveSpeaker()||output:output,camera:state.camera?stream.getActiveCamera()||camera:camera};
  }
  async function select(payload:unknown) {
    const choice=studioDeviceSelectionSchema.parse(payload),found=list(),state=active();
    const available=choice.kind==='microphone'?found.microphones:choice.kind==='speaker'?found.speakers:found.cameras;
    if(choice.id!=='default'&&!available.some(item=>item.id===choice.id))throw new Error('El dispositivo ya no está disponible.');
    if(choice.kind==='microphone'){if(state.audio)await checked(stream.switchMicrophone(choice.id));input=choice.id;}
    else if(choice.kind==='speaker'){if(state.audio)await checked(stream.switchSpeaker(choice.id));output=choice.id;}
    else {if(state.camera){const id=choice.id==='default'?available[0]?.id:choice.id;if(!id)throw new Error('No hay cámara disponible.');await checked(stream.switchCamera(id));}camera=choice.id;}
  }
  return {list,select,audioOptions:()=>({...input!=='default'?{microphoneId:input}:{},...output!=='default'?{speakerId:output}:{}}),videoOptions:()=>camera==='default'?{}:{cameraId:camera}};
}
