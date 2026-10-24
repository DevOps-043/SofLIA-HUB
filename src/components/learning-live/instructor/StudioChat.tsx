import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useStudioRuntime } from './StudioRuntimeContext';
import { LiveIcon } from '../LiveIcon';
import { STUDIO_COMMANDS, type StudioMessage, type StudioRoom } from './studio-types';
import { StudioNumberField } from './StudioNumberField';
import { StudioReactionPicker } from '../StudioReactionPicker';
import { useStudioTime } from '../useStudioTime';

export function StudioChat({ initialMessages = [], room = null, compact = false }: { initialMessages?: StudioMessage[]; room?: StudioRoom | null; compact?: boolean }) {
  const runtime = useStudioRuntime();
  const [localMessages, setMessages] = useState(initialMessages);
  const messages: StudioMessage[] = runtime ? runtime.snapshot.state.messages.map((post) => ({ id: post.id, authorId: post.user_id, author: post.author, role: post.instructor ? 'instructor' : 'participant', text: post.content, time: new Date(post.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), question: post.question ? post.content : undefined, roomId: post.room_id ?? undefined })) : localMessages;
  const canManage = runtime?.snapshot.can_manage ?? true;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const roomKey = room?.id ?? 'main';
  const draft = drafts[roomKey] ?? '';
  const composerId = useId();
  const sending = useRef(false);
  const writable = canManage || (!lockedForParticipant());
  function lockedForParticipant() {
    const rules=runtime?.snapshot.state.moderation;
    return !!rules && (rules.locked || !!rules.restrictions[runtime!.snapshot.user_id]);
  }
  function setDraft(value: string | ((previous: string) => string)) { setDrafts((previous) => ({ ...previous, [roomKey]: typeof value === 'function' ? value(previous[roomKey] ?? '') : value })); }
  const [localLocked, setLocalLocked] = useState(false);
  const [localReactions, setLocalReactions] = useState(true);
  const [localInterval,setLocalInterval]=useState(0);
  const interval=runtime?.snapshot.state.moderation.message_interval_seconds??localInterval;
  const [intervalDraft,setIntervalDraft]=useState(interval);
  const [reactionPicker,setReactionPicker]=useState(false);
  const lastPost=runtime?.snapshot.state.participation?.[runtime.snapshot.user_id]?.last_message_at;
  const serverNow=useStudioTime(runtime?.snapshot.server_time??'',lastPost&&interval>0&&!canManage?Date.parse(lastPost)+interval*1000:undefined);
  const remaining=!canManage&&interval>0&&lastPost?Math.max(0,Math.ceil((Date.parse(lastPost)+interval*1000-serverNow)/1000)):0;
  const [soflia, setSoflia] = useState(false);
  const [moderation, setModeration] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [localRestricted, setRestricted] = useState<string[]>([]);
  const [localBlocked, setBlocked] = useState<string[]>([]);
  const locked = runtime?.snapshot.state.moderation.locked ?? localLocked;
  const reactions = runtime?.snapshot.state.moderation.reactions ?? localReactions;
  const restricted = runtime ? Object.keys(runtime.snapshot.state.moderation.restrictions).filter((id) => runtime.snapshot.state.moderation.restrictions[id] === 'chat') : localRestricted;
  const blocked = runtime ? Object.keys(runtime.snapshot.state.moderation.restrictions).filter((id) => runtime.snapshot.state.moderation.restrictions[id] === 'blocked') : localBlocked;
  function setLocked(value: boolean) { if (runtime) void runtime.send({ type: 'moderation', locked: value, reactions }); else setLocalLocked(value); }
  function setReactions(value: boolean) { if (runtime) void runtime.send({ type: 'moderation', locked, reactions: value }); else setLocalReactions(value); }
  const [tab, setTab] = useState<'all' | 'questions'>('all');
  const [notice, setNotice] = useState('');
  const messageList = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  useEffect(() => { followMessages.current=true; }, [roomKey,tab]);
  const contextual = messages.filter((message) => (message.roomId ?? null) === (room?.id ?? null));
  const visible = contextual.filter((message) => !blocked.includes(message.authorId) && (tab === 'all' || message.question));
  const latestMessage=visible[visible.length-1]?.id;
  useEffect(() => {
    const list=messageList.current;
    if(list&&followMessages.current) list.scrollTop=list.scrollHeight;
  }, [latestMessage,visible.length,roomKey,tab]);
  const contributions = messages.filter((message) => message.role === 'participant');
  const authors = new Map<string, { name: string; count: number }>();
  const questions = new Map<string, number>();
  for (const message of contributions) {
    const previous = authors.get(message.authorId);
    authors.set(message.authorId, { name: message.author, count: (previous?.count ?? 0) + 1 });
    if (message.question) questions.set(message.question, (questions.get(message.question) ?? 0) + 1);
  }
  const leader = [...authors.values()].sort((a, b) => b.count - a.count)[0];
  const common = [...questions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const connection=runtime?.realtime;
  const connected=connection==='Realtime conectado';
  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending.current) return;
    if(remaining>0){setNotice(`Espera ${remaining} s antes de volver a enviar.`);return;}
    if (runtime) {
      if(!writable){setNotice('El instructor restringió el envío de mensajes. Tu borrador se conserva.');return;}
      if(!canManage&&text.startsWith('/')){setNotice('Los comandos de moderación están reservados al instructor.');return;}
      let command;
      if (text === '/silenciar' || text === '/abrir') command = { type: 'moderation' as const, locked: text === '/silenciar', reactions };
      else if (text === '/reacciones') command = { type: 'moderation' as const, locked, reactions: !reactions };
      else if (text.startsWith('/')) { setNotice('Comandos disponibles: /silenciar · /abrir · /reacciones. SofLIA requiere política y consentimiento vigentes.'); return; }
      else command = { type: 'post' as const, content: text, question: text.endsWith('?') || text.includes('¿'), room_id: room?.id ?? null };
      sending.current=true;
      try {
        if (await runtime.send(command)) { setDraft(previous=>previous===draft?'':previous); setNotice(''); }
        else setNotice('No se envió el mensaje. Conservamos tu borrador para reintentar.');
      } catch { setNotice('No se envió el mensaje. Conservamos tu borrador para reintentar.'); }
      finally { sending.current=false; }
      return;
    }
    if (text.startsWith('/')) {
      switch (text.toLocaleLowerCase()) {
        case '/silenciar': setLocked(true); setNotice('Chat de participantes en modo lectura.'); break;
        case '/abrir': setLocked(false); setNotice('Chat abierto para participantes.'); break;
        case '/reacciones': setReactions(!reactions); setNotice(reactions ? 'Reacciones desactivadas.' : 'Reacciones activadas.'); break;
        case '/soflia': setSoflia(!soflia); setNotice(soflia ? 'Interacciones SofLIA desactivadas.' : 'Interacciones SofLIA activadas en el diseño.'); break;
        default: setNotice(`Comandos disponibles: ${STUDIO_COMMANDS}`);
      }
    } else {
      setMessages((previous) => [...previous.slice(-99), { id: crypto.randomUUID(), authorId: 'instructor-local', author: 'Tú', role: 'instructor', roomId: room?.id, text: text.slice(0, 2000), time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }]);
      setNotice('Mensaje añadido a la vista de diseño.');
    }
    setDraft('');
  }
  function moderateUser(action: 'restrict' | 'block') {
    if (!selectedUser) return;
    if (runtime) { void runtime.send({ type: 'restrict', user_id: selectedUser, restriction: action === 'block' ? 'blocked' : restricted.includes(selectedUser) ? 'none' : 'chat' }); setSelectedUser(null); return; }
    if (action === 'block') setBlocked((previous) => [...previous, selectedUser]);
    else setRestricted((previous) => previous.includes(selectedUser) ? previous.filter((id) => id !== selectedUser) : [...previous, selectedUser]);
    setNotice(action === 'block' ? 'Usuario excluido de esta vista de diseño.' : 'Restricción de chat actualizada en esta vista.');
    setSelectedUser(null);
  }
  async function saveInterval(){
    if(!canManage)return;
    if(runtime){const success=await runtime.send({type:'chat_interval',seconds:intervalDraft});setNotice(success?'Intervalo de chat actualizado.':'No se guardó el intervalo. Vuelve a intentarlo.');}
    else {setLocalInterval(intervalDraft);setNotice('Intervalo actualizado en la vista de diseño.');}
  }
  return <aside className="studio-chat-column" aria-label="Chat y participación">
    <section className="studio-panel studio-chat">
      <header className="studio-panel-heading"><h2><LiveIcon name="chat" />{room ? `Chat · ${room.name}` : 'Chat de la sesión'}</h2>{!compact && <button className="studio-icon-button" aria-label="Moderar chat" disabled={!canManage} aria-expanded={moderation} onClick={() => {setIntervalDraft(interval);setModeration(!moderation);}}><LiveIcon name="settings" /></button>}</header>
      <div className="studio-chat-tabs"><button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Todos <span>{contextual.length}</span></button><button aria-pressed={tab === 'questions'} onClick={() => setTab('questions')}>Preguntas <span>{contextual.filter((message) => message.question).length}</span></button></div>
      {connection&&<div className="studio-chat-connection" role="status"><span><i className={connected?'is-connected':''}/>{connected?'Chat en vivo':connection==='Conectando Realtime'?'Conectando chat…':'Sin conexión en vivo'}</span>{!connected&&connection!=='Conectando Realtime'&&<button onClick={()=>void (runtime.reconnect?.()??runtime.refresh())}>Reconectar chat</button>}</div>}
      {moderation && <div className="studio-moderation" aria-label="Controles de moderación">
        <strong><LiveIcon name="shield" />Moderación</strong>
        <label>Solo el instructor puede escribir<input type="checkbox" role="switch" checked={locked} onChange={(event) => setLocked(event.target.checked)} /></label>
        <label>Permitir reacciones<input type="checkbox" role="switch" checked={reactions} onChange={(event) => setReactions(event.target.checked)} /></label>
        <label>Interacciones con SofLIA<input type="checkbox" role="switch" disabled={!!runtime} title={runtime ? 'Requiere política y consentimiento de IA vigentes' : undefined} checked={soflia} onChange={(event) => setSoflia(event.target.checked)} /></label>
        <div><label>Espera entre mensajes de participantes</label><div className="studio-chat-interval"><StudioNumberField label="Intervalo de chat en segundos" min={0} max={300} value={intervalDraft} onChange={setIntervalDraft} compact disabled={runtime?.busy}/><button type="button" disabled={runtime?.busy||intervalDraft===interval} onClick={()=>void saveInterval()}>Aplicar</button></div><small>Segundos · 0 sin espera. El instructor puede escribir sin límite.</small></div>
        <p>{STUDIO_COMMANDS}</p>
        {runtime && blocked.map((userId) => <button key={userId} disabled={runtime.busy} onClick={() => void runtime.send({ type: 'restrict', user_id: userId, restriction: 'none' })}>Restablecer acceso · {messages.find((message) => message.authorId === userId)?.author || userId.slice(0, 8)}</button>)}
      </div>}
      {room && <div className="studio-chat-room-label"><LiveIcon name="users" />Retroalimentación en {room.name}</div>}<div className="studio-chat-state"><span className={locked ? 'is-muted' : ''}><LiveIcon name={locked ? 'lock' : 'chat'} />{locked ? 'Participantes en modo lectura' : 'Chat abierto'}</span>{soflia && <span className="studio-ai-label"><LiveIcon name="sparkles" />SofLIA</span>}</div>
      <div ref={messageList} onScroll={event=>{const list=event.currentTarget;followMessages.current=list.scrollHeight-list.clientHeight-list.scrollTop<40;}} className="studio-message-list" role="log" aria-label={room ? `Mensajes de ${room.name}` : 'Mensajes de la sesión'} aria-live="polite">
        {visible.length === 0 && <div className="studio-empty"><LiveIcon name="chat" /><p>La conversación empieza aquí.</p><small>Los mensajes de tu grupo aparecerán en este espacio.</small></div>}
        {visible.map((message) => <article className={`studio-message studio-message-${message.role}`} key={message.id}>
          <span className={`studio-person-avatar avatar-${message.role}`}>{message.role === 'soflia' ? <LiveIcon name="sparkles" /> : message.author.slice(0, 1)}</span>
          <div><div className="studio-message-author"><strong>{message.author}</strong>{message.role === 'instructor' && <span className="studio-role-badge">INSTRUCTOR</span>}{message.role === 'soflia' && <span className="studio-role-badge ai-badge">ASISTENTE</span>}<time>{message.time}</time></div><p>{message.text}</p>{restricted.includes(message.authorId) && <small className="studio-muted">{runtime ? "Chat restringido" : "Chat restringido · diseño"}</small>}
          {selectedUser === message.authorId && <div className="studio-user-actions"><button onClick={() => moderateUser('restrict')}>{restricted.includes(message.authorId) ? 'Quitar restricción' : 'Restringir chat'}</button><button onClick={() => moderateUser('block')}>{runtime ? 'Bloquear acceso al aula' : 'Bloquear de la transmisión'}</button><button onClick={() => setSelectedUser(null)}>Cancelar</button></div>}</div>
          {canManage && message.role === 'participant' && <button className="studio-message-menu studio-icon-button" aria-label={`Moderar a ${message.author}`} onClick={() => setSelectedUser(selectedUser === message.authorId ? null : message.authorId)}><LiveIcon name="more" /></button>}
        </article>)}
      </div>
      {reactionPicker&&<StudioReactionPicker roomId={room?.id??null} onComplete={()=>setReactionPicker(false)}/>}
      <form className="studio-chat-composer" onSubmit={submit}><label className="studio-sr-only" htmlFor={composerId}>{canManage ? "Tu mensaje como instructor" : "Tu mensaje al grupo"}</label><textarea id={composerId} rows={1} maxLength={2000} placeholder={room ? `Escribe a ${room.name}…` : compact ? 'Escribe al grupo…' : 'Escribe al grupo o usa /comando…'} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><div className="studio-composer-actions">{reactions && <button type="button" className="studio-icon-button" aria-label="Añadir reacción" disabled={runtime?.snapshot.state.moderation.restrictions[runtime.snapshot.user_id]==='blocked'} aria-expanded={reactionPicker} title="Reaccionar en la transmisión" onClick={()=>setReactionPicker(!reactionPicker)}><LiveIcon name="smile" /></button>}<button type="submit" className="studio-send" aria-label={room ? `Enviar mensaje a ${room.name}` : 'Enviar mensaje al grupo'} disabled={!draft.trim() || runtime?.busy || !writable || remaining>0}><LiveIcon name="send" /></button></div></form>
      {remaining>0&&<p className="studio-chat-countdown" role="timer" aria-live="off">Puedes enviar otro mensaje en {remaining} s.</p>}
      {notice && <div className="studio-chat-notice" role="status">{notice}</div>}
    </section>
    {!compact && <section className="studio-panel studio-statistics" aria-label="Estadísticas de participación"><header className="studio-panel-heading"><h2>Participación</h2><span className="studio-tiny-label">{runtime ? "ÚLTIMOS 100 MENSAJES" : "ESTA SESIÓN"}</span></header><div className="studio-stat-values"><div><strong>{contributions.length}</strong><span>Mensajes del grupo</span></div><div><strong>{authors.size}</strong><span>Participantes activos</span></div></div><div className="studio-top-participant"><span className="studio-person-avatar">{leader?.name.slice(0, 1) || '—'}</span><div><small>Mayor participación</small><strong>{leader?.name || 'Aún sin actividad'}</strong></div><span>{leader ? `${leader.count} mensajes` : '—'}</span></div><div className="studio-common-questions"><h3>Preguntas más comunes</h3>{common.length ? common.map(([question, count]) => <p key={question}><span>{question}</span><b>{count}</b></p>) : <p className="studio-muted">Aparecerán cuando el grupo participe.</p>}</div></section>}
  </aside>;
}
