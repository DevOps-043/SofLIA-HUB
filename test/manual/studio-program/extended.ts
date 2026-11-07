import {StudioProgramAudioSender} from '../../../src/services/studio-program-audio';
import {receiveProgramAudio} from '../../../packages/zoom-runtime/program-audio';
import {manageZoomSharing} from '../../../packages/zoom-runtime/share-lifecycle';
import {StudioProgramRenderer} from '../../../src/services/studio-program-renderer';
import {saveSceneBank,loadSceneBank} from '../../../src/services/studio-scene-store';
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function hasAudio(stream:MediaStream){
  const context=new AudioContext();await context.resume();
  const analyser=context.createAnalyser(),input=context.createMediaStreamSource(stream),silent=context.createGain();silent.gain.value=0;
  input.connect(analyser);analyser.connect(silent);silent.connect(context.destination);
  const data=new Float32Array(analyser.fftSize);
  try{for(let i=0;i<30;i++){await delay(100);analyser.getFloatTimeDomainData(data);if(data.some(value=>Math.abs(value)>.01))return true;}return false;}
  finally{input.disconnect();await context.close();}
}
export async function verifyExtendedProgram(){
  const context=new AudioContext();await context.resume();
  const tone=context.createOscillator(),output=context.createMediaStreamDestination();tone.connect(output);tone.start();
  const receiver=receiveProgramAudio((type,detail)=>{if(type==='program-audio-answer'){const value=detail as {id:string;answer:unknown};sender.accept(value.id,value.answer);}});
  const sender=new StudioProgramAudioSender((type,detail)=>{if(type==='program-audio-pending')receiver.expect(detail);else if(type==='program-audio-offer')void receiver.offer(detail).catch(error=>console.error('QA_AUDIO_RECEIVER',error.message));else receiver.close();});
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const drawing=canvas.getContext('2d')!;drawing.fillStyle='#ff0000';drawing.fillRect(0,0,320,180);
  const source=canvas.captureStream(15);
  const tracks=[...source.getVideoTracks(),...output.stream.getAudioTracks()];
  const pcm=new ArrayBuffer(44+44100*2),view=new DataView(pcm);
  const word=(at:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
  word(0,'RIFF');view.setUint32(4,pcm.byteLength-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,44100,true);view.setUint32(28,88200,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,88200,true);
  for(let i=0;i<44100;i++)view.setInt16(44+i*2,Math.sin(i*440*2*Math.PI/44100)*16000,true);
  const url=URL.createObjectURL(new Blob([pcm],{type:'audio/wav'}));
  const element=document.createElement('audio');element.src=url;element.loop=true;element.muted=true;
  const programCanvas=document.createElement('canvas');document.body.append(programCanvas);
  const program=new StudioProgramRenderer(programCanvas,()=>{throw new Error('Falló la composición de prueba.');});
  try{
    const connected=await sender.set(output.stream);
    for(let i=0;i<30&&!receiver.track();i++)await delay(100);
    const audioTrack=receiver.track();if(!connected||!audioTrack)throw new Error('No se conectó el audio local.');
    const display=canvas.captureStream(15);
    const devices={getDisplayMedia:async()=>display} as unknown as MediaDevices;
    const sharing=manageZoomSharing(devices,()=>{},receiver.ready);
    const captured=await devices.getDisplayMedia({video:true,audio:true});
    const audioTransport=captured.getAudioTracks().length===1&&captured.getAudioTracks()[0]!==audioTrack&&await hasAudio(captured);
    sharing.dispose();
    if(audioTrack.readyState!=='live')throw new Error('Detener compartir cerró el audio del programa.');
    await element.play();
    const video={audio:element,close(){element.pause();element.removeAttribute('src');},draw(ctx:CanvasRenderingContext2D){ctx.fillStyle='#ff0000';ctx.fillRect(0,0,1280,720);}};
    await program.take(video,{effect:'cut',durationMs:100});
    const mixed=await program.setAudioEnabled(true);
    const audioMix=!!mixed&&await hasAudio(mixed);
    program.setOverlay({close(){},draw(ctx){ctx.fillStyle='#00ff00';ctx.fillRect(0,0,1280,720);}});
    program.setLabel('Clase de prueba');await delay(1000);
    const pixel=program.canvas.getContext('2d')!.getImageData(1000,550,1,1).data;
    const cameraOverlay=pixel[1]>180&&pixel[0]<60;
    const scene={id:crypto.randomUUID(),kind:'slide' as const,name:'Preparación',title:'Clase',description:'Conservada'};
    const key='qa:'+crypto.randomUUID();
    const pending=[saveSceneBank(key,[{scene}]),saveSceneBank(key,[{scene:{...scene,title:'Última edición'}}])];
    const restored=loadSceneBank(key);await Promise.all(pending);
    const bank=await restored,other=await loadSceneBank(key+':otro-actor');
    const sceneRecovery=bank[0]?.scene.title==='Última edición'&&other.length===0;
    if(!audioTransport||!audioMix||!cameraOverlay||!sceneRecovery)throw new Error('Falló una comprobación audiovisual o de recuperación: '+JSON.stringify({audioTransport,audioMix,cameraOverlay,sceneRecovery}));
    return {audioTransport,audioMix,cameraOverlay,sceneRecovery};
  }finally{
    sender.close();receiver.close();program.close();programCanvas.remove();URL.revokeObjectURL(url);tone.stop();tracks.forEach(track=>track.stop());await context.close();
  }
}
