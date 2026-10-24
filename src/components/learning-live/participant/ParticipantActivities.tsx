import { useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { useStudioRuntime } from '../instructor/StudioRuntimeContext';

export function ParticipantActivities({onPractice,onExpandedChange}: {onPractice:(id?:string)=>void;onExpandedChange?:(expanded:boolean)=>void}) {
  const runtime=useStudioRuntime()!;
  const {state,user_id,asset_urls}=runtime.snapshot;
  const [tab,setTab]=useState<'activities'|'materials'>('activities');
  const [open,setOpen]=useState<{kind:'practice'|'quiz';id:string}|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [notice,setNotice]=useState('');
  const quiz=state.quizzes.find(item=>item.id===state.active_quiz_id);
  const practice=open?.kind==='practice'?state.practices.find(item=>item.id===open.id):undefined;
  const openQuiz=open?.kind==='quiz'&&quiz?.id===open.id?quiz:undefined;
  const saved=practice?state.submissions.find(item=>item.practice_id===practice.id&&item.user_id===user_id):undefined;
  const draft=practice?(drafts[practice.id]??saved?.content??''):'';
  const count=state.practices.length+(quiz?1:0);
  function edit(id:string) { onExpandedChange?.(true);setOpen({kind:'practice',id});onPractice(id);setNotice(''); }
  function close() { onExpandedChange?.(false);setOpen(null);onPractice(undefined); }
  async function submitPractice() {
    if(!practice) return;
    const success=await runtime.send({type:'submit_practice',practice_id:practice.id,content:draft.trim()});
    setNotice(success?'Entrega guardada.':'No se guardó la entrega. Conservamos tu borrador para reintentar.');
  }
  return <section className={`participant-learning-dock studio-panel ${open?'is-expanded':''}`} aria-label="Actividades y materiales">
    <div className="participant-tabs" role="tablist" aria-label="Contenido del curso"><button role="tab" id="participant-activities-tab" aria-controls="participant-activities-panel" aria-selected={tab==='activities'} onClick={()=>{setTab('activities');close();}}>Actividades <b>{count}</b></button><button role="tab" id="participant-materials-tab" aria-controls="participant-materials-panel" aria-selected={tab==='materials'} onClick={()=>{setTab('materials');close();}}>Materiales <b>{state.materials.length}</b></button></div>
    <div className="participant-activity-list" id="participant-activities-panel" role="tabpanel" aria-labelledby="participant-activities-tab" hidden={tab!=='activities'||!!open}>
      {!count&&<p className="participant-content-empty">Las actividades aparecerán cuando el instructor las comparta.</p>}
      {quiz&&<article className="participant-activity-row"><span className="participant-activity-symbol"><LiveIcon name="quiz" /></span><div><small>QUIZ EN CURSO</small><strong>{quiz.question}</strong><span>{state.answers.some(item=>item.quiz_id===quiz.id&&item.user_id===user_id)?'Respuesta guardada':'Responde cuando estés listo'}</span></div><button className="participant-primary" onClick={()=>{onExpandedChange?.(true);setOpen({kind:'quiz',id:quiz.id});setNotice('');}}>Abrir quiz</button></article>}
      {state.practices.map(item=><article className="participant-activity-row" key={item.id}><span className="participant-activity-symbol"><LiveIcon name="file" /></span><div><small>PRÁCTICA</small><strong>{item.title}</strong><span>{state.submissions.some(entry=>entry.practice_id===item.id&&entry.user_id===user_id)?'Tu entrega · Guardada':'Tu entrega · Pendiente'}</span></div><button className="participant-primary" onClick={()=>edit(item.id)}>Abrir actividad</button></article>)}
    </div>
    <div className="participant-activity-list" id="participant-materials-panel" role="tabpanel" aria-labelledby="participant-materials-tab" hidden={tab!=='materials'||!!open}>
      {!state.materials.length&&<p className="participant-content-empty">Aquí encontrarás las lecturas y archivos de la clase.</p>}
      {state.materials.map(item=><article className="participant-activity-row" key={item.id}><span className="participant-activity-symbol"><LiveIcon name={item.kind==='reading'?'book':'file'}/></span><div><strong>{item.name}</strong><span>{Math.ceil(item.bytes/1024)} KB</span></div>{asset_urls[item.asset_path]?<a href={asset_urls[item.asset_path]} target="_blank" rel="noopener noreferrer" className="participant-secondary">Abrir material</a>:<span className="participant-muted">No disponible</span>}</article>)}
    </div>
    {open&&<section className="participant-open-activity" aria-label="Actividad abierta"><header><h3>{practice?.title||openQuiz?.question||'Actividad finalizada'}</h3><button className="studio-icon-button" aria-label="Cerrar actividad" onClick={close}><LiveIcon name="close"/></button></header><div className="participant-workspace-scroll">
      {practice?<form className="participant-practice-form" onSubmit={event=>{event.preventDefault();void submitPractice();}}><p>{practice.instructions}</p><label>Tu entrega<textarea required maxLength={2000} rows={6} value={draft} onChange={event=>{setDrafts(previous=>({...previous,[practice.id]:event.target.value}));setNotice('');}} /></label><small>Tu borrador se conserva mientras permanezcas en esta sesión.</small><button type="submit" className="studio-primary-button" disabled={runtime.busy||!(draft).trim()}>Guardar entrega</button></form>:openQuiz?<div className="participant-quiz-options">{state.answers.some(item=>item.quiz_id===openQuiz.id&&item.user_id===user_id)?<p>Respuesta guardada.</p>:<><p>Selecciona una respuesta.</p>{openQuiz.options.map((option,index)=><button key={index} disabled={runtime.busy} onClick={async()=>{const ok=await runtime.send({type:'answer_quiz',quiz_id:openQuiz.id,answer:index});setNotice(ok?'Respuesta guardada.':'No se guardó tu respuesta. Reintenta.');}}><span>{String.fromCharCode(65+index)}</span>{option}</button>)}</>}</div>:<p>El instructor retiró o cerró esta actividad.</p>}
      {notice&&<p role="status">{notice}</p>}
    </div></section>}
  </section>;
}
