import { useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import type { StudioPreparedScene } from './studio-types';

export function StudioSceneCanvas({ scene }: { scene: StudioPreparedScene }) {
  const [mediaError, setMediaError] = useState(false);
  if (scene.assetUrl && !mediaError) return <div className="studio-scene-media">
    {scene.kind === 'video' ? <video src={scene.assetUrl} aria-label={`Video de ${scene.name}`} muted loop playsInline controls onError={() => setMediaError(true)} /> : <img src={scene.assetUrl} alt={scene.title} onError={() => setMediaError(true)} />}
    <span>{scene.name} · archivo local</span>
  </div>;
  if (scene.kind !== 'slide') return <div className="studio-preview-empty"><LiveIcon name={scene.kind === 'screen' ? 'screen' : 'file'} /><h3>{scene.title}</h3><p>{mediaError ? 'No pudimos mostrar este archivo. Prueba con otro formato compatible.' : 'Fuente de pantalla preparada. La captura real se conectará después.'}</p>{scene.description && <small>{scene.description}</small>}</div>;
  return <div className="studio-example-slide"><div className="studio-slide-brand"><LiveIcon name="book" />SofLIA<span>LEARNING</span></div><div className="studio-slide-content"><span>{scene.name.toLocaleUpperCase()}</span><h3>{scene.title}</h3><p>{scene.description}</p></div><div className="studio-slide-footer"><span>ESCENA PREPARADA</span><span>VISTA LOCAL</span></div></div>;
}
