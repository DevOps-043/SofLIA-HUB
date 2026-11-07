/** Señalización WebRTC local sin servidores ICE ni intercambio de credenciales. */
export async function gatherLocalDescription(peer:RTCPeerConnection):Promise<RTCSessionDescriptionInit>{
  if(peer.iceGatheringState!=='complete')await new Promise<void>((resolve,reject)=>{
    const finish=()=>{if(peer.iceGatheringState==='complete'){clearTimeout(timer);peer.removeEventListener('icegatheringstatechange',finish);resolve();}};
    const timer=setTimeout(()=>{peer.removeEventListener('icegatheringstatechange',finish);reject(new Error('La conexión local no respondió.'));},8000);
    peer.addEventListener('icegatheringstatechange',finish);finish();
  });
  if(!peer.localDescription)throw new Error('No se pudo preparar la conexión local.');
  return peer.localDescription.toJSON();
}
export function waitForLocalPeer(peer:RTCPeerConnection,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);peer.removeEventListener('connectionstatechange',check);signal.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(new Error('La conexión local se canceló.'));};
    const check=()=>{if(peer.connectionState==='connected'){cleanup();resolve();}else if(['closed','failed'].includes(peer.connectionState)){cleanup();reject(new Error('No se conectó el audio local.'));}};
    const timer=setTimeout(()=>{cleanup();reject(new Error('La conexión local no respondió.'));},10000);
    peer.addEventListener('connectionstatechange',check);signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)abort();else check();
  });
}
