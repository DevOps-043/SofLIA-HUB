import { useEffect, useRef } from 'react';
export function StudioStreamVideo({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => { video.pause(); video.srcObject = null; };
  }, [stream]);
  return <video ref={ref} aria-label={label} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}
