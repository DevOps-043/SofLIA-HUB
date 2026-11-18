import { useState } from 'react';
import { usePracticeDrafts, type PracticeDraftStore } from '../usePracticeDrafts';
import { LiveIcon } from '../LiveIcon';
import { StudioLiveClock } from '../instructor/StudioLiveClock';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';
import { useRoomVisit } from './useRoomVisit';
import './session-rooms.css';

/** El componente permanece montado al volver al grupo para conservar borradores. */
export function RoomWorkspace({onResourcesChange,draftStore}:{onResourcesChange?:(visible:boolean)=>void;draftStore?:PracticeDraftStore} = {}) {
  const runtime = useStudioRuntime()!;
  const { state, user_id, can_manage, rooms_version } = runtime.snapshot;
  const current = state.members.find(member => member.user_id === user_id)?.room_id;
  const room = state.rooms.find(item => item.id === current);
  const practice = state.practices.find(item => item.id === state.room_activity?.practice_id);
  const [tab, setTab] = useState<'instructions' | 'team' | 'delivery' | 'resources'>('instructions');
  const localDrafts=usePracticeDrafts();
  const {drafts,setDraft}=draftStore??localDrafts;
  const [notices, setNotices] = useState<Record<string, string>>({});
  const { visit, visiting, error } = useRoomVisit();
  if (!room) return null;
  const saved = practice && state.submissions.find(item => item.practice_id === practice.id && item.user_id === user_id);
  const draft = practice ? drafts[practice.id] ?? (saved ? saved.content : '') : '';
  const members = state.members.filter(member => room.user_ids.includes(member.user_id) || member.instructor && member.room_id === room.id);
  async function submit() {
    if (!practice || runtime.busy || !draft.trim()) return;
    const id = practice.id;
    try {
      const ok = await runtime.send({ type: 'submit_practice', practice_id: id, content: draft.trim() });
      setNotices(previous => ({ ...previous, [id]: ok ? 'Entrega guardada en Learning.' : 'No se guardó tu entrega. Conservamos tu borrador para reintentar.' }));
    } catch { setNotices(previous => ({ ...previous, [id]: 'No se guardó tu entrega. Conservamos tu borrador para reintentar.' })); }
  }
  return <section className="room-workspace studio-panel" aria-label="Espacio de trabajo de la sala">
    <header className="room-workspace-heading"><div className="room-heading-title"><span className="room-emblem"><LiveIcon name="users" /></span><div><small>ESPACIO DE EQUIPO</small><h2>{room.name}</h2></div></div><button className="room-secondary" disabled={runtime.busy || visiting} onClick={() => void visit(null)}><LiveIcon name="back" />{visiting ? 'Cambiando…' : 'Volver al grupo principal'}</button></header>
    <div className="room-context-line"><span>{practice?.title || 'Trabajo en sala'}</span><StudioLiveClock compact /></div>
    <div className="room-tabs" role="tablist" aria-label="Trabajo de la sala">{([{ id: 'instructions', label: 'Instrucciones', icon: 'file' }, { id: 'team', label: 'Mi equipo', icon: 'users' }, { id: 'delivery', label: can_manage ? 'Entregas' : 'Mi entrega', icon: 'check' }, ...(onResourcesChange ? [{id:'resources' as const,label:'Actividades y materiales',icon:'book' as const}] : [])] as const).map(item => <button key={item.id} role="tab" id={`room-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={item.id==='resources'?'room-shared-resources':`room-panel-${item.id}`} onClick={() => {setTab(item.id);onResourcesChange?.(item.id==='resources');}}><LiveIcon name={item.icon} />{item.label}</button>)}</div>
    <div hidden={tab==='resources'} className="room-workspace-content" role="tabpanel" id={`room-panel-${tab}`} aria-labelledby={`room-tab-${tab}`}>
      {tab === 'instructions' && (practice ? <><span className="room-kicker">ACTIVIDAD DE LA SALA</span><h3>{practice.title}</h3><p className="room-instructions">{practice.instructions}</p><div className="room-info"><LiveIcon name="sparkles" /><span>Conversen en el chat del equipo y preparen su respuesta. Cada participante guarda su propia entrega.</span></div><button className="room-primary" onClick={() => setTab('delivery')}>{can_manage ? 'Revisar entregas' : 'Preparar mi entrega'}<LiveIcon name="arrow" /></button></> : <div className="room-empty"><LiveIcon name="file" /><h3>Tu equipo ya tiene un espacio</h3><p>El instructor compartirá las instrucciones de la actividad. Mientras tanto, pueden conversar en el chat de esta sala.</p></div>)}
      {tab === 'team' && <><span className="room-kicker">PERSONAS DEL EQUIPO</span><p className="room-muted">{members.filter(member => member.room_id === room.id).length} presentes en esta sala{rooms_version === 1 ? ` · ${room.user_ids.length} asignados` : ''}</p><ul className="room-member-list">{members.map(member => <li key={member.user_id}><span className="room-avatar">{member.name.slice(0, 1).toLocaleUpperCase()}</span><div><strong>{member.name}{member.user_id === user_id ? ' (tú)' : ''}</strong><small>{member.instructor ? 'Instructor de visita' : member.room_id === room.id ? 'En la sala' : 'En el grupo principal'}</small></div></li>)}</ul>{!members.length && <p>Las personas conectadas aparecerán aquí.</p>}</>}
      {tab === 'delivery' && (!practice ? <div className="room-empty"><LiveIcon name="file" /><h3>Actividad pendiente</h3><p>Las entregas se habilitarán cuando haya una actividad vinculada a estas salas.</p></div> : can_manage ? <><h3>Entregas de {room.name}</h3><p className="room-muted">Entregas personales de esta actividad.</p>{state.submissions.filter(item => item.practice_id === practice.id && room.user_ids.includes(item.user_id)).map(item => <article className="room-submission" key={item.user_id}><strong>{state.members.find(member => member.user_id === item.user_id)?.name || 'Participante desconectado'}</strong><p>{item.content}</p></article>)}{!state.submissions.some(item => item.practice_id === practice.id && room.user_ids.includes(item.user_id)) && <p>Aún no hay entregas de este equipo.</p>}</> : <form className="room-delivery" onSubmit={event => { event.preventDefault(); void submit(); }}><h3>{practice.title}</h3><label htmlFor="room-personal-delivery">Tu respuesta individual</label><textarea id="room-personal-delivery" required maxLength={2000} rows={7} value={draft} onChange={event => { setDraft(practice.id,event.target.value); setNotices(previous => ({ ...previous, [practice.id]: '' })); }} /><div className="room-delivery-meta"><small>{draft.length}/2000 · Borrador durante esta sesión</small><span>{saved ? 'Entrega guardada' : 'Sin entregar'}</span></div><button className="room-primary" disabled={runtime.busy || !draft.trim()} type="submit"><LiveIcon name="check" />{runtime.busy ? 'Guardando…' : saved ? 'Actualizar mi entrega' : 'Guardar mi entrega'}</button>{notices[practice.id] && <p role="status">{notices[practice.id]}</p>}</form>)}
    </div>{error && <p className="room-error" role="alert">{error}</p>}
  </section>;
}
