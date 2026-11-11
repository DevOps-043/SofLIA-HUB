import {afterEach,describe,expect,it,vi} from 'vitest';
import {StudioProgramAudioSender} from '../../services/studio-program-audio';
import {waitForLocalPeer} from '../../shared/local-peer';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
describe('transporte local de audio de programa',()=>{
  it('espera conexión efectiva y cancela una espera sin anunciar éxito',async()=>{
    vi.useFakeTimers();
    const peer=Object.assign(new EventTarget(),{connectionState:'connecting'}) as unknown as RTCPeerConnection;
    const abort=new AbortController();let connected=false;
    const promise=waitForLocalPeer(peer,abort.signal).then(()=>{connected=true;});
    await Promise.resolve();expect(connected).toBe(false);
    Object.assign(peer,{connectionState:'connected'});peer.dispatchEvent(new Event('connectionstatechange'));
    await promise;expect(connected).toBe(true);
    Object.assign(peer,{connectionState:'connecting'});
    const pending=waitForLocalPeer(peer,abort.signal);abort.abort();
    await expect(pending).rejects.toThrow('canceló');
  });
  it('rechaza confirmaciones de otro intento y no detiene la pista original al cerrar',async()=>{
    const peers:Array<RTCPeerConnection>=[];
    class Peer extends EventTarget{
      connectionState='new';iceGatheringState='complete';localDescription={toJSON:()=>({type:'offer',sdp:'v=0\r\nm=audio 9 RTP/AVP 0'})};onconnectionstatechange:()=>void=()=>{};
      addTrack=vi.fn();setLocalDescription=vi.fn(async()=>{});createOffer=vi.fn(async()=>this.localDescription.toJSON());
      setRemoteDescription=vi.fn(async()=>{});close=vi.fn(()=>{this.connectionState='closed';});
      constructor(){super();peers.push(this as unknown as RTCPeerConnection);}
    }
    vi.stubGlobal('RTCPeerConnection',Peer);
    const send=vi.fn(),original={readyState:'live',stop:vi.fn()};
    const sender=new StudioProgramAudioSender(send);
    const pending=sender.set({getAudioTracks:()=>[original]} as unknown as MediaStream);
    for(let i=0;i<8;i++)await Promise.resolve();
    const offer=send.mock.calls.find(call=>call[0]==='program-audio-offer')?.[1];
    expect(offer).toBeDefined();
    sender.accept('otro-intento',{type:'answer',sdp:'ajena'});
    expect(peers[0].setRemoteDescription).not.toHaveBeenCalled();
    sender.close();expect(await pending).toBe(false);
    expect(original.stop).not.toHaveBeenCalled();expect(peers[0].close).toHaveBeenCalled();
  });
});
