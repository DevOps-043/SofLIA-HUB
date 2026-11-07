import {gatherLocalDescription,waitForLocalPeer} from '../shared/local-peer';
import {outputOfferSchema,outputAnswerSchema} from '../shared/studio-program';

/** Solo envía una pista de programa; no captura dispositivos ni detiene pistas ajenas. */
export class StudioProgramAudioSender{
  private peer:RTCPeerConnection|null=null;
  private epoch=0;
  private pending:{id:string;resolve:(answer:unknown)=>void}|null=null;
  private abort:AbortController|null=null;
  constructor(private send:(type:string,detail?:unknown)=>void,private failed?:()=>void){}
  accept(id:string,answer:unknown){if(this.pending?.id===id)this.pending.resolve(answer);}
  close(){this.epoch++;this.abort?.abort();this.abort=null;this.pending?.resolve(null);this.pending=null;this.peer?.close();this.peer=null;this.send('program-audio-stop');}
  async set(stream:MediaStream|null):Promise<boolean>{
    this.close();
    if(!stream)return true;
    const track=stream.getAudioTracks().find(item=>item.readyState==='live');if(!track)return false;
    const epoch=this.epoch,peer=new RTCPeerConnection({iceServers:[]});this.peer=peer;
    const abort=new AbortController();this.abort=abort;
    const id=crypto.randomUUID();this.send('program-audio-pending',{id});
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      peer.addTrack(track,stream);
      await peer.setLocalDescription(await peer.createOffer());
      const offer=outputOfferSchema.parse(await gatherLocalDescription(peer),{jitless:true});
      if(epoch!==this.epoch)return false;
      const answer=await new Promise<unknown>(resolve=>{
        this.pending={id,resolve};
        timer=setTimeout(()=>resolve(null),10000);
        this.send('program-audio-offer',{id,offer});
      });
      clearTimeout(timer);
      if(epoch!==this.epoch)return false;
      this.pending=null;
      await peer.setRemoteDescription(outputAnswerSchema.parse(answer,{jitless:true}));
      await waitForLocalPeer(peer,abort.signal);
      if(epoch!==this.epoch)return false;
      peer.onconnectionstatechange=()=>{if(epoch===this.epoch&&['failed','disconnected'].includes(peer.connectionState)){this.close();this.failed?.();}};
      return true;
    }catch{if(epoch===this.epoch)this.close();return false;}
    finally{clearTimeout(timer);}
  }
}
