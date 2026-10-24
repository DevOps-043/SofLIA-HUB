import { useRef, useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import type { StudioPreparedScene } from './studio-types';

export function StudioSceneCanvas({ scene }: { scene: StudioPreparedScene }) {
  const [mediaError, setMediaError] = useState(false);
  const position = useRef(0), playing = useRef(false);
  if (scene.kind === 'screen' && scene.capture) return <div className="studio-scene-media">{scene.capture.thumbnail && <img src={scene.capture.thumbnail} alt={`Fuente ligada: ${scene.capture.name}`} />}<span>{scene.capture.name} · fuente ligada · pulsa Compartir</span></div>;
  if (scene.assetUrl && !mediaError) return <div className="studio-scene-media">
    {scene.kind === 'video' ? <video src={scene.assetUrl} aria-label={`Video de ${scene.name}`} muted loop playsInline controls onTimeUpdate={(event) => { position.current = event.currentTarget.currentTime; }} onPlay={() => { playing.current = true; }} onPause={(event) => { if (event.currentTarget.readyState) playing.current = false; }} onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(position.current, event.currentTarget.duration || 0); if (playing.current) void event.currentTarget.play().catch(() => {}); }} onError={() => setMediaError(true)} /> : <img src={scene.assetUrl} alt={scene.title} onError={() => setMediaError(true)} />}
    <span>{scene.name} · contenido de la escena</span>
  </div>;
  if (scene.kind === 'holding') return <div className="studio-holding-preview"><span>SOFLIA / LEARNING</span><small>{scene.name}</small><h3>{scene.title}</h3><p>{scene.description}</p>{!!scene.holding?.seconds && <strong>{String(Math.floor(scene.holding.seconds / 60)).padStart(2, '0')}:{String(scene.holding.seconds % 60).padStart(2, '0')}</strong>}</div>;
  if (scene.kind !== 'slide') return <div className="studio-preview-empty"><LiveIcon name={scene.kind === 'screen' ? 'screen' : 'file'} /><h3>{scene.title}</h3><p>{mediaError ? 'No pudimos mostrar este archivo. Prueba con otro formato compatible.' : scene.kind === 'screen' ? 'Vincula una fuente real desde Cambiar fuente.' : 'Este archivo no está disponible.'}</p>{scene.description && <small>{scene.description}</small>}</div>;
  return <div className="studio-example-slide"><div className="studio-slide-brand"><LiveIcon name="book" />SofLIA<span>LEARNING</span></div><div className="studio-slide-content"><span>{scene.name.toLocaleUpperCase()}</span><h3>{scene.title}</h3><p>{scene.description}</p></div></div>;
}
