import { useEffect, useRef } from 'react';
import { gatherLocalDescription } from '../../../services/studio-output';
import { outputAnswerSchema, outputOfferSchema } from '../../../shared/studio-program';

/** Esta vista no carga App, identidad, dispositivos ni APIs generales del Hub. */
export function StudioOutputReceiver() {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const api = window.studioOutputReceiver;
    if (!api) return;
    const peer = new RTCPeerConnection({ iceServers: [] });
    let id = '', disposed = false;
    const fail = () => { if (!disposed && id) void api.state({ id, state: 'error' }); };
    peer.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) fail(); };
    peer.ontrack = (event) => {
      if (disposed || event.track.kind !== 'video' || !video.current) { event.track.stop(); return; }
      const element = video.current; element.srcObject = new MediaStream([event.track]);
      element.onplaying = () => { if (!disposed) void api.state({ id, state: 'ready' }); };
      void element.play().catch(fail);
    };
    void (async () => {
      const data = await api.offer(); if (!data || disposed) return;
      id = data.id;
      await peer.setRemoteDescription(outputOfferSchema.parse(data.offer, { jitless: true }));
      await peer.setLocalDescription(await peer.createAnswer());
      const answer = outputAnswerSchema.parse(await gatherLocalDescription(peer), { jitless: true });
      if (!disposed) await api.answer({ id, answer });
    })().catch(fail);
    const element = video.current;
    return () => { disposed = true; peer.close(); if (element) { (element.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop()); element.srcObject = null; } };
  }, []);
  return <video ref={video} muted playsInline style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', objectFit: 'contain', background: '#0f1419' }} aria-label="Salida del curso" />;
}
