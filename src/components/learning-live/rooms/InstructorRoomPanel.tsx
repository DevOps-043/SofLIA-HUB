import { useRef, useState, type FormEvent } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioNumberField } from '../instructor/StudioNumberField';
import { StudioDialog } from '../instructor/StudioDialog';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';
import { useStudioMediaRuntime } from '../instructor/StudioMediaContext';
import { availableRoomMembers, roomConnectionLabel, roomDistribution } from './room-model';
import { useRoomVisit } from './useRoomVisit';
import type { StudioCommand } from '../../../shared/live-studio.contract';
import './session-rooms.css';

export function InstructorRoomPanel({ onReturn, onVisit }: { onReturn: () => void; onVisit?: () => void }) {
  const runtime = useStudioRuntime()!;
  const media = useStudioMediaRuntime();
  const { snapshot } = runtime, { state } = snapshot;
  const [practiceId, setPracticeId] = useState('');
  const [mode, setMode] = useState<'size' | 'count'>('size'), [value, setValue] = useState(4);
  const [notice, setNotice] = useState(''), [pending, setPending] = useState(false), [confirmClose, setConfirmClose] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null), [name, setName] = useState('');
  const sending = useRef(false);
  const { visit, visiting, error } = useRoomVisit();
  const supported = snapshot.rooms_version === 1;
  const available = availableRoomMembers(snapshot);
  const practice = state.practices.find(item => item.id === practiceId);
  const activePractice = state.practices.find(item => item.id === state.room_activity?.practice_id);
  const sizes = roomDistribution(available.length, mode, value);
  const current = state.members.find(member => member.user_id === snapshot.user_id)?.room_id;
  const disabled = runtime.busy || pending || visiting;
  const candidates = [...new Set([...available.map(member => member.user_id), ...state.rooms.flatMap(room => room.user_ids)])].filter(id => state.moderation.restrictions[id] !== 'blocked');
  async function send(command: StudioCommand, success: string) {
    if (sending.current || runtime.busy) return false;
    sending.current = true; setPending(true); setNotice('');
    try {
      const ok = await runtime.send(command);
      setNotice(ok ? success : 'No se guardó el cambio. Revisa el estado y vuelve a intentarlo.');
      return ok;
    } catch { setNotice('No se guardó el cambio. Vuelve a intentarlo.'); return false; }
    finally { sending.current = false; setPending(false); }
  }
  function selectPractice(id: string) {
    setPracticeId(id);
    const next = state.practices.find(item => item.id === id);
    if (next?.collaboration?.mode === 'teams') { setMode('size'); setValue(next.collaboration.team_size); }
  }
  async function open(event: FormEvent) {
    event.preventDefault();
    if (!sizes.length || practice?.collaboration?.mode === 'individual') return;
    await send(supported ? { type: 'open_rooms', practice_id: practiceId || null, mode, value } : { type: 'rooms', mode, value }, 'Salas abiertas. El grupo ya puede entrar a sus equipos.');
  }
  return <section className="room-control-panel" aria-label="Panel de salas">
    <header className="room-workspace-heading"><div className="room-heading-title"><span className="room-emblem"><LiveIcon name="users" /></span><div><small>SESIÓN SÍNCRONA</small><h2>Salas de trabajo</h2></div></div><button className="room-secondary" onClick={onReturn}><LiveIcon name="video" />Ver transmisión</button></header>
    <p className="room-panel-intro">Un espacio para que cada equipo ponga sus ideas en práctica.</p>
    <div className="room-summary"><div><strong>{state.rooms.length || '—'}</strong><span>Salas abiertas</span></div><div><strong>{available.length}</strong><span>Participantes conectados</span></div><div><strong>{available.filter(member => !state.rooms.some(room => room.user_ids.includes(member.user_id))).length}</strong><span>Sin asignar</span></div></div>
    {!state.rooms.length ? <form className="room-preparation" onSubmit={event => void open(event)}><div className="room-section-heading"><span className="room-step">1</span><div><h3>Prepara la actividad</h3><p>Revisa las instrucciones antes de distribuir a tu grupo.</p></div></div>
      <label htmlFor="room-activity-select">Actividad de las salas</label><select id="room-activity-select" value={practiceId} disabled={!supported || disabled} onChange={event => selectPractice(event.target.value)}><option value="">Trabajo libre · sin actividad vinculada</option>{state.practices.map(item => <option key={item.id} value={item.id}>{item.title}{item.collaboration?.mode === 'individual' ? ' · Individual' : ''}</option>)}</select>
      {practice && <article className="room-activity-brief"><small>{practice.collaboration?.mode === 'teams' ? `PROPUESTA DE ARCHITECT · ≈ ${practice.collaboration.team_size} PERSONAS POR EQUIPO` : practice.collaboration?.mode === 'individual' ? 'ACTIVIDAD INDIVIDUAL' : 'INSTRUCCIONES DE LA ACTIVIDAD'}</small><h4>{practice.title}</h4><p>{practice.instructions}</p></article>}
      {!supported && <p className="room-info">Actualiza Learning para vincular actividades y ajustar asignaciones. Puedes preparar una distribución básica.</p>}
      <div className="room-section-heading"><span className="room-step">2</span><div><h3>Organiza los equipos</h3><p>Puedes ajustar la propuesta de Architect para esta sesión.</p></div></div>
      <div className="room-distribution-controls"><label htmlFor="room-distribution-mode">Distribuir por<select id="room-distribution-mode" value={mode} disabled={disabled} onChange={event => setMode(event.target.value as typeof mode)}><option value="size">Personas por sala</option><option value="count">Número de salas</option></select></label><StudioNumberField label={mode === 'size' ? 'Personas por sala' : 'Número de salas'} disabled={disabled} value={value} min={1} max={50} onChange={setValue} /></div>
      <div className="room-distribution-preview" aria-label="Vista previa de distribución">{sizes.length ? <><strong>{sizes.length} {sizes.length === 1 ? 'sala' : 'salas'} · {available.length} personas</strong><div>{sizes.map((size, index) => <span key={index}><LiveIcon name="users" />Sala {index + 1}<b>{size}</b></span>)}</div><small>La distribución se confirma con quienes sigan conectados al abrir. Podrás ajustar las asignaciones después.</small></> : <p>Cuando se conecten participantes podrás distribuirlos en salas.</p>}</div>
      {practice?.collaboration?.mode === 'individual' && <p role="alert">Esta actividad está definida como individual. Selecciona una actividad en equipos para abrir salas.</p>}
      <button type="submit" className="room-primary" disabled={disabled || !sizes.length || practice?.collaboration?.mode === 'individual'}><LiveIcon name="users" />{pending ? 'Abriendo salas…' : 'Abrir salas de trabajo'}</button>
    </form> : <div className="room-open-management"><div className="room-section-heading"><span className="room-live-dot" /><div><h3>{activePractice?.title || 'Trabajo libre en equipos'}</h3><p>{state.rooms.length} salas disponibles · visita y acompaña a tus equipos.</p></div><button className="room-secondary" disabled={disabled} onClick={() => setConfirmClose(true)}>Cerrar salas</button></div>
      {activePractice && <details className="room-activity-brief"><summary>Ver instrucciones de la actividad</summary><p>{activePractice.instructions}</p></details>}
      <p className="room-connection-state" role="status"><LiveIcon name="video" />{roomConnectionLabel(!!media?.zoomConnected, media?.roomsStatus?.status, media?.roomsStatus?.missing, media?.roomsStatus?.reason)}</p>
      {current && <button className="room-secondary" onClick={onReturn}>Ver galería de esta sala</button>}
      <div className="room-cards">{state.rooms.map(room => <article className={`room-card ${current === room.id ? 'is-current' : ''}`} key={room.id}><header><span className="room-emblem"><LiveIcon name="users" /></span><div><h3>{room.name}</h3><small>{room.user_ids.length} asignados · {state.members.filter(member => member.room_id === room.id && !member.instructor).length} presentes</small></div>{supported && <button className="studio-icon-button" aria-label={`Renombrar ${room.name}`} disabled={disabled} onClick={() => { setRenaming(room.id); setName(room.name); }}><LiveIcon name="settings" /></button>}</header><ul className="room-card-members">{room.user_ids.map(id => { const member = state.members.find(item => item.user_id === id); return <li key={id}><span className="room-avatar">{member?.name.slice(0, 1) || '?'}</span><span>{member?.name || 'Participante desconectado'}</span><small>{member?.room_id === room.id ? 'En sala' : member ? 'En el grupo' : 'Sin conexión'}</small></li>; })}</ul>{!room.user_ids.length && <p className="room-muted">Sin integrantes. Asigna participantes desde la lista inferior.</p>}<button className={current === room.id ? 'room-secondary' : 'room-primary'} disabled={disabled || current === room.id} onClick={async () => { if (await visit(room.id)) onVisit?.(); }}><LiveIcon name={current === room.id ? 'check' : 'arrow'} />{current === room.id ? 'Estás en esta sala' : `Visitar ${room.name}`}</button></article>)}</div>
      {supported && <section className="room-assignments" aria-label="Asignaciones del grupo"><h3>Ajusta las asignaciones</h3><p className="room-muted">Los cambios se guardan al elegir un destino. Quien cambie de sala regresará al grupo principal para entrar a su nuevo equipo.</p>{candidates.map(id => { const member = state.members.find(item => item.user_id === id), assigned = state.rooms.find(room => room.user_ids.includes(id)); return <label key={id}><span>{member?.name || 'Participante desconectado'}</span><select aria-label={`Sala de ${member?.name || id}`} disabled={disabled} value={assigned?.id || ''} onChange={event => void send({ type: 'assign_room', user_id: id, room_id: event.target.value || null }, 'Asignación guardada.')}><option value="">Grupo principal · sin asignar</option>{state.rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>; })}</section>}
    </div>}
    {(notice || error) && <p className="room-notice" role="status">{error || notice}</p>}
    {confirmClose && <StudioDialog title="Cerrar las salas de trabajo" onClose={() => setConfirmClose(false)}><p>Todos volverán al grupo principal y se retirarán las asignaciones actuales. Las entregas y las instrucciones de la actividad se conservan.</p><button className="studio-primary-button" disabled={disabled} onClick={async () => { if (await send({ type: 'close_rooms' }, 'Salas cerradas. El grupo vuelve a la sesión principal.')) setConfirmClose(false); }}>Cerrar salas y reunir al grupo</button>{notice&&<p role="status">{notice}</p>}</StudioDialog>}
    {renaming && <StudioDialog title="Nombre de la sala" onClose={() => setRenaming(null)}><form onSubmit={async event => { event.preventDefault(); if (await send({ type: 'rename_room', room_id: renaming, name: name.trim() }, 'Nombre de sala guardado.')) setRenaming(null); }}><label>Nombre<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} /></label><button className="studio-primary-button" disabled={disabled || !name.trim()}>Guardar nombre</button>{notice&&<p role="status">{notice}</p>}</form></StudioDialog>}
  </section>;
}
