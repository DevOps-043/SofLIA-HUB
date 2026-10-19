import { outputAnswerSchema, outputOfferSchema } from '../shared/studio-program';

export async function gatherLocalDescription(peer: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  if (peer.iceGatheringState !== 'complete') await new Promise<void>((resolve, reject) => {
    const finish = () => { if (peer.iceGatheringState === 'complete') { clearTimeout(timer); peer.removeEventListener('icegatheringstatechange', finish); resolve(); } };
    const timer = setTimeout(() => { peer.removeEventListener('icegatheringstatechange', finish); reject(new Error('La salida local no respondió.')); }, 8000);
    peer.addEventListener('icegatheringstatechange', finish); finish();
  });
  if (!peer.localDescription) throw new Error('No se pudo preparar la salida.');
  return peer.localDescription.toJSON();
}
export async function connectProgramOutput(stream: MediaStream, isCurrent: () => boolean): Promise<(closeRemote?: boolean) => void> {
  const api = window.studioOutput;
  if (!api) throw new Error('Reinicia Hub para preparar la salida continua.');
  const peer = new RTCPeerConnection({ iceServers: [] });
  try {
    stream.getVideoTracks().forEach((track) => peer.addTrack(track, stream));
    await peer.setLocalDescription(await peer.createOffer());
    const offer = outputOfferSchema.parse(await gatherLocalDescription(peer), { jitless: true });
    if (!isCurrent()) throw new Error('Se canceló la salida.');
    const result = await api.open(offer);
    if (!result.success) throw new Error(result.error);
    if (!isCurrent()) { await api.close(); throw new Error('Se canceló la salida.'); }
    await peer.setRemoteDescription(outputAnswerSchema.parse(result.answer, { jitless: true }));
    return (closeRemote = true) => { peer.close(); if (closeRemote) void api.close(); };
  } catch (error) { peer.close(); throw error; }
}
