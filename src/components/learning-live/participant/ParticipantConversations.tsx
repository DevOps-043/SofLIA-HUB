import { useEffect, useRef, useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioChat } from '../instructor/StudioChat';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';
import { participantTutorContext } from '../../../services/participant-tutor';
import type { StudioRoom } from '../instructor/studio-types';
import { useParticipantTutor } from './useParticipantTutor';

export function ParticipantConversations({ room, practiceId }: {room: StudioRoom | null; practiceId?: string}) {
  const {snapshot,reference} = useStudioRuntime()!;
  const [tab,setTab] = useState<'group'|'soflia'>('group');
  const tutor=useParticipantTutor(participantTutorContext(snapshot,practiceId), reference ? {reference,userId:snapshot.user_id} : undefined);
  const list=useRef<HTMLDivElement>(null);
  const contextual=snapshot.state.messages.filter(item=>item.room_id===(room?.id??null));
  const [readIds,setReadIds]=useState<string[]>([]);
  const unread=tab==='group'?0:contextual.filter(item=>item.user_id!==snapshot.user_id&&!readIds.includes(item.id)).length;
  function change(next: typeof tab) { setReadIds(contextual.map(item=>item.id));setTab(next); }
  useEffect(()=>{ if (list.current) list.current.scrollTop=list.current.scrollHeight; },[tutor.messages,tutor.answer]);
  return <aside className="participant-conversations studio-panel" aria-label="Conversaciones de la sesión">
    <div className="participant-tabs" role="tablist" aria-label="Conversaciones"><button role="tab" id="participant-group-tab" aria-controls="participant-group-panel" aria-selected={tab==='group'} onClick={()=>change('group')}><LiveIcon name="chat" />{room?'Chat de mi equipo':'Chat del grupo'}{unread>0&&<b>{unread}</b>}</button><button role="tab" id="participant-soflia-tab" aria-controls="participant-soflia-panel" aria-selected={tab==='soflia'} onClick={()=>change('soflia')}><LiveIcon name="sparkles" />Soflia</button></div>
    <div className="participant-group-panel" id="participant-group-panel" role="tabpanel" aria-labelledby="participant-group-tab" hidden={tab!=='group'}><StudioChat room={room} compact /></div>
    <div className="participant-tutor" id="participant-soflia-panel" role="tabpanel" aria-labelledby="participant-soflia-tab" hidden={tab!=='soflia'}>
      <header><span className="participant-tutor-symbol"><LiveIcon name="sparkles" /></span><div><strong>Soflia</strong><small>Ayuda individual · durante esta sesión</small></div></header>
      <div className="participant-tutor-context"><LiveIcon name="file" /><span>{practiceId?'Contexto: práctica abierta':'Contexto: esta clase'}</span></div>
      <div className="participant-tutor-messages" ref={list} role="log" aria-label="Conversación individual con Soflia" aria-live="polite">
        {!tutor.messages.length&&!tutor.pending&&<div className="participant-tutor-empty"><LiveIcon name="sparkles" /><h3>Aprendamos paso a paso</h3><p>Pide una pista o un ejemplo sobre lo que estás aprendiendo.</p><small>Tu pregunta y la actividad abierta se envían a la IA de Hub. No se publican en el chat del grupo.</small></div>}
        {tutor.messages.map((item,index)=><article key={index} className={`participant-tutor-message is-${item.role}`}><strong>{item.role==='user'?'Tú':'Soflia'}</strong><p>{item.text}</p></article>)}
        {tutor.pending&&<><article className="participant-tutor-message is-user"><strong>Tú</strong><p>{tutor.draft}</p></article><article className="participant-tutor-message is-model"><strong>Soflia</strong><p>{tutor.answer||'Pensando…'}</p></article></>}
      </div>
      {tutor.error&&<p className="participant-inline-notice" role="alert">{tutor.error}</p>}
      <div className="participant-tutor-suggestions"><button disabled={tutor.pending} onClick={()=>void tutor.send('Dame una pista para la actividad abierta.')}><LiveIcon name="sparkles" />Dame una pista</button><button disabled={tutor.pending} onClick={()=>void tutor.send('Explícame el tema con un ejemplo sencillo.')}><LiveIcon name="book" />Un ejemplo</button></div>
      <form className="studio-chat-composer" onSubmit={event=>{event.preventDefault();void tutor.send();}}><label className="studio-sr-only" htmlFor="participant-tutor-message">Tu pregunta a Soflia</label><textarea id="participant-tutor-message" disabled={tutor.pending} rows={1} maxLength={2000} placeholder="Pregúntale a Soflia…" value={tutor.draft} onChange={event=>tutor.setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/><button type={tutor.pending?'button':'submit'} className="studio-send" aria-label={tutor.pending?'Detener respuesta de Soflia':'Enviar pregunta a Soflia'} disabled={!tutor.pending&&!tutor.draft.trim()} onClick={tutor.pending?tutor.cancel:undefined}><LiveIcon name={tutor.pending?'pause':'send'} /></button></form>
    </div>
  </aside>;
}
