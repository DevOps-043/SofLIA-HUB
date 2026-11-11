import {outputAnswerSchema,outputOfferSchema} from '../../src/shared/studio-program';
import {gatherLocalDescription} from '../../src/shared/local-peer';

export function receiveProgramAudio(send:(type:string,detail?:unknown)=>void){
  let peer:RTCPeerConnection|null=null,track:MediaStreamTrack|null=null,sink:HTMLAudioElement|null=null,epoch=0;
  let expected:string|null=null;
  const waits=new Set<()=>void>();
  const updates=new Set<()=>void>();
  function close(){epoch++;expected=null;for(const cancel of waits)cancel();waits.clear();updates.clear();track?.stop();track=null;peer?.close();peer=null;if(sink){sink.pause();sink.srcObject=null;sink.remove();sink=null;}}
  function ready():Promise<MediaStreamTrack|null>{
    if(!expected)return Promise.resolve(null);
    if(track?.readyState==='live'&&!track.muted)return Promise.resolve(track);
    return new Promise((resolve,reject)=>{
      let current:MediaStreamTrack|null=null;
      const cleanup=()=>{clearTimeout(timer);waits.delete(cancel);updates.delete(check);current?.removeEventListener('unmute',check);};
      const cancel=()=>{cleanup();reject(new Error('El audio del programa se canceló.'));};
      const check=()=>{if(track?.readyState==='live'&&!track.muted){cleanup();resolve(track);}else if(track&&track!==current){current=track;track.addEventListener('unmute',check,{once:true});}};
      const timer=setTimeout(()=>{cleanup();reject(new Error('Espera a que el audio del programa esté preparado antes de compartir.'));},18000);
      waits.add(cancel);
      updates.add(check);
      check();
    });
  }
  return {
    close,
    ready,
    expect(input:unknown){
      if(!input||typeof input!=='object'||!('id' in input)||typeof input.id!=='string'||!/^[-a-f0-9]{36}$/.test(input.id))throw new Error('Solicitud de audio inválida.');
      close();expected=input.id;
    },
    track:()=>track,
    async offer(input:unknown){
      if(!input||typeof input!=='object'||!('id' in input)||typeof input.id!=='string'||!/^[-a-f0-9]{36}$/.test(input.id)||!('offer' in input))throw new Error('Oferta de audio inválida.');
      const offer=outputOfferSchema.parse(input.offer,{jitless:true});
      const media=offer.sdp.match(/^m=\w+/gm);
      if(media?.length!==1||media[0]!=='m=audio')throw new Error('La conexión solo admite audio del programa.');
      if(expected!==input.id||peer)throw new Error('La solicitud de audio ya no está vigente.');
      const generation=epoch,connection=new RTCPeerConnection({iceServers:[]});peer=connection;
      connection.ontrack=event=>{
        if(generation!==epoch||event.track.kind!=='audio'||track){event.track.stop();return;}
        track=event.track;
        // Chromium mantiene activo el decodificador remoto con un receptor mudo.
        sink=document.createElement('audio');sink.muted=true;sink.volume=0;sink.autoplay=true;
        sink.srcObject=new MediaStream([track]);document.body.append(sink);void sink.play().catch(()=>{});
        updates.forEach(check=>check());
      };
      try{
        await connection.setRemoteDescription(offer);
        await connection.setLocalDescription(await connection.createAnswer());
        const answer=outputAnswerSchema.parse(await gatherLocalDescription(connection),{jitless:true});
        if(generation===epoch)send('program-audio-answer',{id:input.id,answer});
      }catch(error){if(generation===epoch)close();throw error;}
    },
  };
}
