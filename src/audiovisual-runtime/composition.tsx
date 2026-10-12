import type { CSSProperties } from 'react';
import type { CinematicFilm } from '../shared/audiovisual/film-schema';
import { sceneState, sceneBoxes, ease, mix, type SceneState } from '../shared/audiovisual/frame';
import { Ecosystem, Knowledge, ProductPanel } from './product-scenes';
import { Icon, Reveal } from './kit';
import { SofliaMark } from './soflia-mark';
import './film.css';
import { frameStamp } from '../shared/audiovisual/frame-stamp';

export function FilmComposition({ film, frame, captureNonce }: { film: CinematicFilm; frame: number; captureNonce?:number }) {
  const state = sceneState(film, frame), { scene, index, entrance } = state;
  const theme = { '--film-bg': film.direccion.fondo, '--film-panel': film.direccion.superficie, '--film-text': film.direccion.texto, '--film-accent': film.direccion.acento, '--film-secondary': film.direccion.secundario } as CSSProperties;
  const previous = index > 0 && entrance < 1 ? { ...sceneState(film, scene.inicio - 1), frame: state.frame } : null;
  return <><main className="film-stage" style={theme} aria-label={film.titulo} data-frame={state.frame} data-style={film.direccion.estilo}>
    <div className="film-atmosphere" />
    {previous && <div className="film-layer" style={{ opacity: 1 - entrance, transform: `scale(${1 + entrance * .04})` }}><Scene film={film} state={previous} fold={scene.composicion==='cierre'?entrance:0} /></div>}
    <div className="film-layer" style={{ opacity: entrance, transform: `translateX(${(1 - entrance) * 60}px) scale(${.985 + .015 * entrance})` }}><Scene film={film} state={state} /></div>
    <SharedTransfers film={film} frame={state.frame} />
    <div className="film-vignette" />
    {scene.composicion !== 'cierre' && <div className="film-production-note">INTERFACES CONCEPTUALES · {film.marca.nombre}</div>}
  </main>{captureNonce!==undefined&&<div style={{position:'absolute',left:0,top:1080,width:1920,height:12*1920/film.ancho,backgroundColor:`rgb(${frameStamp(frame,captureNonce).join(',')})`}} />}</>;
}
function Scene({ film, state, fold = 0 }: { film: CinematicFilm; state: SceneState; fold?:number }) {
  const { scene, progress, local } = state, boxes = sceneBoxes(scene);
  const original = film.entidades.find(e => e.id === scene.elementos[0].id)!;
  const entity = scene.elementos[0].vista ? { ...original,tipo:scene.elementos[0].vista } : original;
  if (scene.composicion === 'cierre') return <div className="film-close" style={{ opacity: state.entrance }}><div className="film-close-mark">{film.marca.logo === 'soflia' && <SofliaMark />}</div><h1 style={{ fontSize: Math.min(104,1600/(film.marca.nombre.length*.98)) }}>{film.marca.nombre}</h1><span className="film-close-rule" /><p>{film.marca.lema}</p></div>;
  const knowledge = ['hero', 'panoramica'].includes(scene.composicion) && ['documento', 'ecosistema'].includes(entity.tipo);
  const editorial = scene.composicion === 'editorial';
  const scale = mix(mix(scene.camara.inicio, scene.camara.fin, ease(progress)),1,fold);
  return <>
    <div className="film-camera" style={{ transform: `translate(${scene.camara.recorridoX * progress*(1-fold)}px,${scene.camara.recorridoY * progress*(1-fold)}px) scale(${scale})` }}>
      {knowledge ? <Knowledge film={film} state={state} entity={entity} /> : scene.composicion === 'ecosistema' ? <Ecosystem film={film} state={state} entity={entity} fold={fold} /> : scene.elementos.map((element, i) => {
        const e = film.entidades.find(item => item.id === element.id)!, box = boxes[i];
        const t = local / film.fps, float = element.movimiento === 'flotar' ? Math.sin(t * .65 + i) * (5 + 4 * element.profundidad) : 0;
        const offsetX = element.movimiento === 'recorrido' ? mix(-18,18,ease(progress)) : 0;
        const display = element.vista ? { ...e, tipo: element.vista } : e;
        return <div key={element.id} className="film-plane" style={{ left: box.x+offsetX, top: box.y + float, width: 1280, height: 760, clipPath: element.movimiento === 'revelar' ? `inset(0 ${(1-ease(t/.9))*100}% 0 0)` : undefined, transform: `perspective(3000px) rotateY(${element.inclinacion * (1 - progress * .4)}deg) rotateX(${element.profundidad * 2}deg) scale(${box.w / 1280})`, opacity: ease((local / film.fps - i * .12) / .5) }}><ProductPanel entity={display} film={film} state={state} /></div>;
      })}
    </div>
    <div className={`film-headline ${editorial ? 'film-headline--editorial' : knowledge ? 'film-headline--hero' : 'film-headline--wide'}${scene.ladoVisual === 'izquierda' ? ' film-headline--right' : ''}`}>
      {!knowledge && <div className="film-product-label">{film.marca.logo === 'soflia' && <SofliaMark />}<span>{editorial ? entity.titulo : scene.titulo}</span></div>}
      <Reveal text={scene.mensaje} frame={local} fps={film.fps} className="film-main-message" accentEnd={state.index > 0} />
      {scene.subtitulo && <p className="film-subtitle" style={{ opacity: ease((local / film.fps - .8) / .8) }}>{scene.subtitulo}</p>}
      {editorial && <span className="film-heading-rule" style={{ transform: `scaleX(${ease(local / film.fps)})` }} />}
    </div>
  </>;
}

/** Un mismo objeto atraviesa el corte; no reinicia su identidad al cambiar de vista. */
function SharedTransfers({ film, frame }: { film: CinematicFilm; frame: number }) {
  return <>{film.escenas.slice(0,-1).map((scene, i) => {
    const cue = scene.acciones.find(a => a.accion === 'transferencia');
    if (!cue) return null;
    const start = scene.inicio + cue.en, end = Math.min(film.escenas[i+1].fin, scene.fin + film.fps * .7);
    if (frame < start || frame >= end) return null;
    const t = ease((frame-start)/(end-start));
    const source = film.entidades.find(e => e.id === cue.entidad)!;
    const document = film.entidades.find(e => e.tipo === 'documento');
    const item = cue.item ? source.filas?.find(row=>row.id===cue.item) : source.tipo === 'curso' ? source.filas?.[0] : document;
    if (!item) return null;
    const next=film.escenas[i+1], incoming=film.entidades.find(e=>e.id===next.elementos[0].id)!;
    const destination=sceneBoxes(next)[0], origin=sceneBoxes(scene)[0];
    const row=Math.max(0,incoming.filas?.findIndex(entry=>entry.id===item.id)??0);
    const targetX=destination.x+(source.tipo==='curso'?95:33), targetY=destination.y+(source.tipo==='curso'?260+row*86:195);
    return <div className="film-transfer" key={cue.entidad} data-shared-object={item.id} style={{ left: mix(origin.x+origin.w*.5, targetX, t), top: mix(590, targetY, t) - Math.sin(t * Math.PI) * 105, opacity: Math.min(1,t*8,(1-t)*8), transform: `scale(${mix(.9,.72,t)}) rotate(${Math.sin(t*Math.PI)*-7}deg)` }}><span className="film-app-icon"><Icon name={source.tipo === 'curso' ? 'leccion' : 'documento'} size={30} /></span><div><small>{source.tipo === 'curso' ? 'MÓDULO DE APRENDIZAJE' : 'CONOCIMIENTO CONSERVADO'}</small><b>{item.titulo}</b></div><Icon name="flecha" /></div>;
  })}</>;
}
