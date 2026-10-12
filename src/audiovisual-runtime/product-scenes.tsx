import type { CinematicFilm, FilmEntity } from '../shared/audiovisual/film-schema';
import { actionProgress, ease, mix, knowledgePortal, type SceneState } from '../shared/audiovisual/frame';
import { Chip, Icon, Meter, Paper, Ring, Window } from './kit';
import { brandPoint,ecosystemPoints,sofliaGeometry } from '../shared/audiovisual/brand-geometry';

type Props = { entity: FilmEntity; state: SceneState; film: CinematicFilm };
const rowsOf = (e: FilmEntity) => e.filas ?? e.etiquetas.map((titulo, i) => ({ id: `${e.id}-${i}`, titulo, estado: 'pendiente' as const, detalle: undefined, progreso: undefined }));

/** El mismo dato documental alimenta las vistas; las filas nunca son texto rasterizado. */
export function ProductPanel({ entity, state, film }: Props) {
  if (entity.tipo === 'documento') return <Paper entity={entity} />;
  if (entity.tipo === 'curso') return <Engine entity={entity} state={state} film={film} />;
  if (entity.tipo === 'leccion') return <Learning entity={entity} state={state} film={film} />;
  return <Hub entity={entity} state={state} film={film} />;
}
function Hub({ entity: e, state, film }: Props) {
  const time = state.local / film.fps, rows = rowsOf(e);
  const analysis = actionProgress(state, e.id, 'analisis', film.fps, 1.3);
  const confirm = actionProgress(state, e.id, 'confirmacion', film.fps, 2.4);
  const instruction = e.instruccion ?? e.detalle;
  const typed = instruction.slice(0, Math.floor(Math.max(0, time - .45) * 38));
  return <Window entity={e} section="Asistente">
    <div className="film-chat-title"><Chip accent>Asistente de trabajo</Chip><h3>{analysis < .2 ? '¿En qué trabajamos hoy?' : 'Del conocimiento a la acción.'}</h3><p>{e.detalle}</p></div>
    <div className="film-chat-request"><span className="film-avatar">T</span><div><p>{typed}<span className="film-caret" style={{ opacity: time < 2 && Math.floor(time * 3) % 2 === 0 ? 1 : 0 }} /></p><div className="film-chip-row">{(film.entidades.find(item => item.tipo === 'documento')?.etiquetas ?? e.etiquetas).slice(0,3).map((label, i) => <div key={label} style={{ opacity: ease((time - .2 - i * .18) / .5) }}><Chip><Icon size={16} />{label}</Chip></div>)}</div></div></div>
    <div className="film-response" style={{ opacity: analysis, transform: `translateY(${(1 - analysis) * 28}px)` }}><div className="film-response-heading"><span className="film-app-icon"><Icon name="red" /></span><b>Propuesta para revisión</b><Chip accent>{confirm > .9 ? 'Validación humana' : 'Analizando fuentes'}</Chip></div><div className="film-pipeline">{rows.slice(0, 4).map((row, i) => {
      const rowConfirm = actionProgress(state,e.id,'confirmacion',film.fps,2.4,.8,row.id);
      const on = actionProgress(state,e.id,'entrada',film.fps,1.75+i*.18,.6,row.id,false);
      return <div className="film-task-column" key={row.id} style={{ opacity: on, transform: `translateY(${(1 - on) * 30}px)` }}><div className="film-task-label"><i /><span>{row.titulo}</span><small>0{i + 1}</small></div><div className="film-task"><Icon name={i === 3 ? 'usuario' : 'documento'} size={25} /><h4>{row.detalle ?? row.titulo}</h4><span className="film-task-divider" /><p>{row.estado === 'revision' ? 'Requiere aprobación' : row.estado === 'completado' ? 'Validado por el equipo' : row.estado === 'activo' ? 'En curso' : 'Preparado para revisión'}</p>{row.progreso !== undefined && <Meter value={row.progreso * rowConfirm} label="Avance declarado de la etapa" />}<div className="film-task-footer"><span className="film-avatar">S</span><Icon name={rowConfirm > .7 && row.estado === 'completado' ? 'check' : 'flecha'} size={22} /></div></div></div>;
    })}</div><div className="film-response-bottom"><Icon name="check" size={22} /><span>Las decisiones permanecen en manos del equipo.</span><Meter value={confirm} /></div></div>
    <div className="film-composer"><Icon name="documento" /><span>Escribe una instrucción…</span><span className="film-send"><Icon name="flecha" /></span></div>
  </Window>;
}
function Engine({ entity: e, state, film }: Props) {
  const time = state.local / film.fps, rows = rowsOf(e);
  const scan = actionProgress(state, e.id, 'analisis', film.fps, .6, 1.1);
  const connect = actionProgress(state, e.id, 'conexion', film.fps, 2.1, 1.2);
  return <Window entity={e} section="Diseño de formación" sidebar={false}>
    <div className="film-stepper">{['Fuente', 'Temario', 'Módulos', 'Lecciones', 'Revisión'].map((label, i) => <span key={label} style={{ opacity: time > i * .65 ? 1 : .42 }}><i>{time > i * .65 + .6 ? <Icon name="check" size={14} /> : i + 1}</i>{label}</span>)}</div>
    <div className="film-engine-grid"><div className="film-source"><div className="film-section-heading"><Icon /><span>CONOCIMIENTO DE ORIGEN</span></div><Paper entity={film.entidades.find(item => item.tipo === 'documento') ?? e} compact /><div className="film-scan" style={{ top: `${18 + scan * 70}%`, opacity: scan > 0 && scan < 1 ? .85 : 0 }} /><Chip accent>Fuente conservada</Chip></div><div className="film-module-map"><div className="film-map-heading"><h3>{e.detalle}</h3><Chip accent>Ruta de aprendizaje</Chip></div><svg className="film-module-lines" viewBox="0 0 700 470"><path d="M350 58V115M160 115H540M160 115V365M540 115V365" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - connect} fill="none" stroke="var(--film-accent)" strokeWidth="2" /></svg><div className="film-module-grid">{rows.slice(0, 4).map((row, i) => {
      const rowConfirm = actionProgress(state,e.id,'confirmacion',film.fps,2.4,.8,row.id);
      const on = actionProgress(state,e.id,'entrada',film.fps,1.1+i*.2,.85,row.id,false);
      return <article className="film-module" key={row.id} style={{ opacity: on, transform: `translate(${(1 - on) * -55}px,${(1 - on) * 18}px) scale(${.94 + .06 * on})` }}><div className="film-module-top"><span className="film-app-icon"><Icon name="leccion" /></span><span>MÓDULO 0{i + 1}</span><Icon name={rowConfirm > .8 && row.estado === 'completado' ? 'check' : 'flecha'} size={21} /></div><h4>{row.titulo}</h4><p>{row.detalle ?? e.etiquetas[i % e.etiquetas.length]}</p><div className="film-rule" /><span className="film-module-unit"><i />Contenido de la fuente</span><span className="film-module-unit"><i />Revisión del equipo</span>{row.progreso !== undefined ? <Meter value={row.progreso * on} label="Avance declarado del módulo" /> : <div className="film-rule" />}</article>;
    })}</div><div className="film-course-footer" style={{ opacity: connect }}><Chip>Fuente trazable</Chip><Chip accent>Listo para revisión</Chip></div></div></div>
  </Window>;
}
function Learning({ entity: e, state, film }: Props) {
  const time = state.local / film.fps, rows = rowsOf(e);
  const arrived = actionProgress(state, e.id, 'entrada', film.fps, .2);
  const complete = actionProgress(state, e.id, 'confirmacion', film.fps, 1.5, 1.5);
  const supplied = e.progreso, progress = (supplied ?? 0) * complete;
  return <Window entity={e} section="Mi aprendizaje" sidebar={false}>
    <div className="film-learning-heading"><div><Chip accent>Ruta personalizada</Chip><h3>{e.instruccion ?? 'Tu conocimiento avanza.'}</h3><p>{e.detalle}</p></div><span className="film-avatar film-avatar--large">T</span></div>
    <div className="film-learning-grid"><section className="film-roadmap"><div className="film-section-heading"><Icon name="curso" /><span>RUTA DE APRENDIZAJE</span></div><svg className="film-route-line" viewBox="0 0 60 480"><path d="M30 20C5 85 55 110 30 175S5 245 30 295S55 350 30 435" fill="none" stroke="var(--film-line)" strokeWidth="5" /><path d="M30 20C5 85 55 110 30 175S5 245 30 295S55 350 30 435" fill="none" stroke="var(--film-accent)" strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} /></svg>{rows.slice(0, 4).map((row, i) => { const rowComplete = actionProgress(state,e.id,'confirmacion',film.fps,1.5,1.5,row.id); return <div className={`film-route-item${row.estado === 'activo' ? ' film-route-item--active' : ''}`} key={row.id} style={{ opacity: ease((time - .5 - i * .15) / .75), transform: `translateX(${(1 - arrived) * 28}px)` }}><span className="film-route-node">{row.estado === 'completado' && rowComplete > .8 ? <Icon name="check" size={20} /> : i + 1}</span><div><h4>{row.titulo}</h4><p>{row.detalle ?? e.etiquetas[i % e.etiquetas.length]}</p>{row.progreso !== undefined && <Meter value={row.progreso * rowComplete} label="Avance declarado de la lección" />}</div><Chip accent={row.estado === 'activo' || row.estado === 'completado'}>{row.estado === 'completado' ? (rowComplete > .8 ? 'Completado' : 'Validando') : row.estado === 'activo' ? 'En curso' : row.estado === 'revision' ? 'En revisión' : 'Por explorar'}</Chip></div>; })}</section>
    <section className="film-progress-panel"><div className="film-section-heading">TU PROGRESO</div><Ring value={progress} label={supplied === undefined ? 'Sin dato' : undefined} /><p>Avance de la ruta</p><div className="film-rule" /><h4>Actividades</h4>{rows.slice(0, 3).map(row => <div className="film-activity" key={row.id}><span className="film-app-icon"><Icon name={row.estado === 'completado' ? 'check' : 'documento'} size={20} /></span><div><b>{row.titulo}</b><small>{row.estado === 'completado' ? 'Revisado' : row.estado === 'revision' ? 'En revisión' : row.estado === 'activo' ? 'En curso' : 'Por explorar'}</small></div></div>)}</section>
    <section className="film-assistant-panel"><div className="film-section-heading"><Icon name="chat" />APOYO AL APRENDIZAJE</div><div className="film-assistant-orb"><Icon name="red" size={46} /></div><h4>Aprende con contexto.</h4><p>Conecta los conceptos con tu trabajo y resuelve dudas durante el recorrido.</p><div className="film-assistant-message" style={{ opacity: actionProgress(state, e.id, 'analisis', film.fps, 2.1) }}><Icon name="chat" /><span>{e.etiquetas[0]}</span></div><div className="film-chip-row"><Chip accent>Explorar</Chip><Chip>Aplicar</Chip></div><div className="film-mini-chart" aria-hidden>{[.34, .57, .46, .78, .63, .9, .72].map((v, i) => <i key={i} style={{ height: `${v * complete * 100}%`, opacity: i % 2 ? .5 : 1 }} />)}</div><small className="film-chart-caption">Actividad ilustrativa, sin datos reales</small></section></div>
  </Window>;
}

/** Fragmentos de conocimiento con profundidad; sus mensajes permanecen en primer plano. */
export function Knowledge({ entity, state, film }: Props) {
  const motion = state.scene.elementos[0].movimiento, time = state.local / film.fps;
  const activated = state.scene.composicion === 'hero' ? 0 : actionProgress(state, entity.id, 'conexion', film.fps, .5, 2);
  const positions = [[155,120,-6,.65],[630,72,5,.52],[1370,105,-5,.7],[1620,320,7,.48],[115,680,-4,.62],[580,830,4,.5],[1260,800,-7,.58],[1565,645,5,.64]];
  const targets = [[260,170],[260,405],[260,640],[720,170],[720,405],[720,640],[1180,170],[1180,640]];
  return <div className="film-knowledge"><svg className="film-knowledge-links" width="1920" height="1080">
    {targets.map(([x,y],i)=>{
      const ax=x+110,ay=y+85,u=(time*.18+i*.13)%1,v=1-u;
      return <g key={i}><path d={`M${ax} ${ay} Q${knowledgePortal.x-200} ${ay} ${knowledgePortal.x} ${knowledgePortal.y}`} fill="none" stroke="var(--film-accent)" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1-activated} opacity={activated*.6} /><circle cx={v*v*ax+2*v*u*(knowledgePortal.x-200)+u*u*knowledgePortal.x} cy={v*v*ay+2*v*u*ay+u*u*knowledgePortal.y} r="4" fill="var(--film-accent)" opacity={activated*.8} /></g>;
    })}
  </svg>{positions.map(([x,y,tilt,scale],i)=><div className="film-fragment" key={i} style={{left:mix(x,targets[i][0],activated),top:mix(y,targets[i][1],activated)+(1-activated)*(motion==='quieto'?0:Math.sin(time*.55+i*.8)*12),transform:`rotate(${tilt*(1-activated)}deg) scale(${mix(scale,.55,activated)})`,filter:`blur(${(i%3===0?1.3:0)*(1-activated)}px)`,opacity:.32+activated*.6}}><Paper entity={{...entity,titulo:entity.etiquetas[i%entity.etiquetas.length],filas:rowsOf(entity).slice(i%2,i%2+2)}} compact /></div>)}
  <div className="film-focus-ring" style={{left:knowledgePortal.x,top:knowledgePortal.y,width:knowledgePortal.radius*2,height:knowledgePortal.radius*2,opacity:activated*.9,transform:`translate(-50%,-50%) scale(${.94+.08*Math.sin(time*.8)})`}} /><div className="film-knowledge-scrim" /></div>;
}
export function Ecosystem({ film, state, entity, fold = 0 }: Props & {fold?:number}) {
  const time=state.local/film.fps, connected=actionProgress(state,entity.id,'conexion',film.fps,.25,1.4);
  const p=film.marca.logo==='soflia'?fold:0;
  const points=ecosystemPoints.map(([x,y],i)=>{const target=brandPoint(i),bend=Math.sin(p*Math.PI)*38;return[mix(x,target[0],p)+bend*(i%2?1:-1),mix(y,target[1],p)-bend*.4];});
  const productIndices=[2,3,4], labels=[entity.etiquetas[0]??'Conocimiento',entity.etiquetas[1]??'Equipos','','','',entity.etiquetas[2]??'Validación humana',entity.etiquetas[3]??'Procesos',entity.etiquetas[4]??'Coordinación'];
  const products=film.entidades.filter(e=>['chat','curso','leccion'].includes(e.tipo)).slice(0,3);
  const finalState={...state,local:film.fps*4.7},scale=.36*(1-p)**2;
  const navy=p>.65?'#082943':'#557B97',teal=p>.65?'#16C1AD':'var(--film-accent)';
  return <div className="film-ecosystem"><svg className="film-eco-lines" width="1920" height="1080">{sofliaGeometry.links.map((link,i)=>{
    const a=points[link.a],b=points[link.b],run=(time*.32+i*.13)%1;
    return <g key={i}><path d={`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`} fill="none" stroke={link.color==='navy'?navy:teal} strokeWidth={mix(2.5,link.width*250/961,p)} pathLength="1" strokeDasharray="1" strokeDashoffset={1-connected} opacity={mix(.5,1,p)} /><circle cx={mix(a[0],b[0],run)} cy={mix(a[1],b[1],run)} r="4" fill="var(--film-accent)" opacity={connected*(1-p)} /></g>;
  })}{points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={mix(17,sofliaGeometry.nodes[i].r*250/961,p)} fill={sofliaGeometry.nodes[i].color==='navy'?navy:teal} opacity={p} />)}</svg>
  {products.map((e,i)=>{const point=points[productIndices[i]],floating=state.scene.elementos[0].movimiento==='quieto'?0:Math.sin(time*.65+i)*5*(1-p);return <div className="film-eco-product" key={e.id} style={{left:point[0]-1280*scale/2,top:point[1]-760*scale/2+floating,opacity:ease((time-i*.15)/.7)*(1-p),transform:`scale(${scale}) rotate(${(i===1?0:i===0?-2:2)*(1-p)}deg)`}}><ProductPanel entity={e} state={finalState} film={film} /><b className="film-eco-caption">{e.titulo}</b></div>;})}
  {points.map(([x,y],i)=>productIndices.includes(i)?null:<div className="film-eco-node" key={i} style={{left:x,top:y,opacity:connected*(1-p)}}><span><Icon name={i===5?'usuario':'red'} size={28} /></span><b>{labels[i]}</b></div>)}
  </div>;
}
