import { useRef, useState, type FormEvent } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioDialog } from './StudioDialog';
import { StudioNumberField } from './StudioNumberField';
import { StudioClock } from './StudioClock';
import SelectDropdown from '../../ui/SelectDropdown';
import { useStudioRuntime } from './StudioRuntimeContext';
import { engineSessionManifestSchema, studioQuizSchema } from '../../../shared/live-studio.contract';
import { studioFileMime } from '../../../services/live-studio-service';

export function StudioLiveActivities() {
  const runtime = useStudioRuntime()!;
  const { state } = runtime.snapshot;
  const [dialog, setDialog] = useState<'rooms' | 'quiz' | 'practice' | null>(null);
  const [mode, setMode] = useState<'size' | 'count'>('size');
  const [value, setValue] = useState(4);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '']);
  const [correct, setCorrect] = useState(0);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<'file' | 'reading' | 'quiz' | 'engine'>('file');
  const file = useRef<HTMLInputElement>(null);
  const participants = state.members.filter((member) => !member.instructor).length;
  function choose(next: typeof kind) {
    setKind(next);
    if (!file.current) return;
    file.current.accept = next === 'engine' || next === 'quiz' ? '.json' : '.pdf,.docx,.pptx,.txt,.md,.epub';
    file.current.multiple = next === 'file' || next === 'reading';
    file.current.click();
  }
  async function selected(files: File[]) {
    if (uploading || !files.length) return;
    setUploading(true); setNotice('');
    try {
      if (kind === 'quiz' || kind === 'engine') {
        if (files.length !== 1 || files[0].size > 32768) throw new Error('Elige un archivo JSON de hasta 32 KB.');
        const json: unknown = JSON.parse(await files[0].text());
        const parsed = kind === 'engine' ? engineSessionManifestSchema.safeParse(json) : studioQuizSchema.safeParse(json);
        if (!parsed.success) throw new Error('El JSON no cumple el contrato de importación. Consulta la guía del estudio.');
        const success = kind === 'engine' ? await runtime.send({ type: 'import_engine', manifest: engineSessionManifestSchema.parse(parsed.data) }) : await runtime.send({ type: 'quiz', quiz: studioQuizSchema.parse(parsed.data) });
        if (success) setNotice(kind === 'engine' ? 'Contenido de Engine importado.' : 'Quiz guardado en Learning.');
        return;
      }
      if (files.length + state.materials.length > 20) throw new Error('Puedes guardar hasta 20 materiales por sesión.');
      for (const item of files) {
        const path = await runtime.upload(item);
        const success = await runtime.send({ type: 'material', material: { id: crypto.randomUUID(), name: item.name, kind, asset_path: path, mime: studioFileMime(item), bytes: item.size } });
        if (!success) return;
      }
      setNotice('Material guardado y disponible para tu grupo.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo subir el material.'); }
    finally { setUploading(false); if (file.current) file.current.value = ''; }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    let success = false;
    if (dialog === 'rooms') success = await runtime.send({ type: 'rooms', mode, value });
    if (dialog === 'practice') success = await runtime.send({ type: 'practice', practice: { id: crypto.randomUUID(), title: title.trim(), instructions: instructions.trim() } });
    if (dialog === 'quiz') {
      const quiz = studioQuizSchema.safeParse({ id: crypto.randomUUID(), question: question.trim(), options: options.map((option) => option.trim()), correct });
      if (!quiz.success) { setNotice('Escribe una pregunta y opciones distintas; selecciona la respuesta correcta.'); return; }
      success = await runtime.send({ type: 'quiz', quiz: quiz.data });
    }
    if (success) { setDialog(null); setNotice('Cambios guardados en Learning.'); }
  }
  return <aside className="studio-panel studio-activities" aria-label="Actividades y recursos"><header className="studio-panel-heading"><h2><LiveIcon name="grid" />Tu caja de herramientas</h2></header><div className="studio-activities-content">
    <div className="studio-section-caption"><span>ACTIVIDADES</span><span>{participants} participantes conectados</span></div>
    <button className="studio-activity-card" disabled={runtime.busy} onClick={() => setDialog('rooms')}><span className="studio-tool-icon"><LiveIcon name="users" /></span><span><strong>Salas de práctica</strong><small>Distribuye al grupo conectado.</small></span><LiveIcon name="plus" /></button>
    {state.rooms.length > 0 && <section className="studio-prepared-activity"><div><strong>{state.rooms.length} salas académicas</strong><button aria-label="Cerrar salas" disabled={runtime.busy} onClick={() => void runtime.send({ type: 'close_rooms' })}><LiveIcon name="close" /></button></div><div className="studio-room-grid">{state.rooms.map((room) => <span key={room.id}>{room.name}<small>{room.user_ids.length} participantes</small></span>)}</div><small>Chat y actividades por sala. Crea las salas de audio en Zoom.</small></section>}
    <button className="studio-activity-card" onClick={() => setDialog('practice')}><LiveIcon name="file" /><span><strong>Crear práctica</strong><small>Instrucciones y entregas del grupo.</small></span><LiveIcon name="plus" /></button>
    {state.practices.map((practice) => <section className="studio-prepared-activity" key={practice.id}><strong>{practice.title}</strong><p>{practice.instructions}</p><small>{state.submissions.filter((submission) => submission.practice_id === practice.id).length} entregas</small><details><summary>Ver entregas</summary>{state.submissions.filter((submission) => submission.practice_id === practice.id).map((submission) => <p key={submission.user_id}><strong>{state.members.find((member) => member.user_id === submission.user_id)?.name || 'Participante'}</strong> · {submission.content}</p>)}</details></section>)}
    <StudioClock />
    <section className="studio-resources" aria-label="Material de la sesión"><div className="studio-section-caption"><span>MATERIAL DE LA SESIÓN</span><span>{state.materials.length}</span></div><div className="studio-resource-actions"><button disabled={uploading} onClick={() => choose('file')}>Archivo</button><button disabled={uploading} onClick={() => choose('reading')}>Lectura</button></div>
      <input ref={file} className="studio-sr-only" aria-label="Subir contenido de la sesión" type="file" accept={kind === 'engine' || kind === 'quiz' ? '.json' : '.pdf,.docx,.pptx,.txt,.md,.epub'} multiple={kind === 'file' || kind === 'reading'} onChange={(event) => void selected(Array.from(event.target.files ?? []))} />
      <div className="studio-quiz-material"><span><LiveIcon name="quiz" /><strong>Quizzes</strong></span><button onClick={() => setDialog('quiz')}>Crear quiz</button><button disabled={uploading} onClick={() => choose('quiz')}>Importar JSON</button></div>
      {state.quizzes.map((quiz) => <section className="studio-prepared-activity" key={quiz.id}><strong>{quiz.question}</strong><small>{state.answers.filter((answer) => answer.quiz_id === quiz.id).length} respuestas</small><button disabled={runtime.busy} onClick={() => void runtime.send({ type: 'publish_quiz', quiz_id: state.active_quiz_id === quiz.id ? null : quiz.id })}>{state.active_quiz_id === quiz.id ? 'Cerrar quiz' : 'Publicar quiz'}</button></section>)}
      <div className="studio-resource-list">{state.materials.map((material) => <article key={material.id}><LiveIcon name={material.kind === 'reading' ? 'book' : 'file'} /><div>{runtime.snapshot.asset_urls[material.asset_path] ? <a href={runtime.snapshot.asset_urls[material.asset_path]} target="_blank" rel="noopener noreferrer">{material.name}</a> : <strong>{material.name}</strong>}<small>{Math.ceil(material.bytes / 1024)} KB · guardado</small></div><button disabled={runtime.busy} aria-label={`Retirar ${material.name}`} onClick={() => void runtime.send({ type: 'remove_material', material_id: material.id })}><LiveIcon name="close" /></button></article>)}</div>
      <button disabled={uploading || runtime.busy} onClick={() => choose('engine')}><LiveIcon name="file" />Importar preparación de Engine</button><small className="studio-muted">{state.engine_revision ? `Revisión de Engine: ${state.engine_revision}` : 'Manifiesto JSON versionado · sin contenido de ejemplo'}</small>
    </section><p role="status">{uploading ? 'Subiendo contenido…' : notice}</p>
  </div>
    {dialog && <StudioDialog title={dialog === 'rooms' ? 'Preparar salas de práctica' : dialog === 'quiz' ? 'Crear quiz' : 'Crear práctica'} onClose={() => setDialog(null)}><form onSubmit={(event) => void create(event)}>
      {dialog === 'rooms' ? <><p>{participants} participantes conectados. La asignación será académica; Zoom administra el audio y video de sus salas.</p><label>Distribuir por<SelectDropdown aria-label="Distribuir por" value={mode} onChange={(next) => setMode(next as typeof mode)} options={[{ value: 'size', label: 'Participantes por sala' }, { value: 'count', label: 'Número de salas' }]} /></label><StudioNumberField label={mode === 'size' ? 'Personas por sala' : 'Número de salas'} value={value} onChange={setValue} min={1} max={50} /></> : dialog === 'practice' ? <><label>Título<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Instrucciones<textarea required maxLength={2000} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label></> : <><label>Pregunta<input required maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} /></label><fieldset><legend>Selecciona la respuesta correcta</legend>{options.map((option, index) => <label key={index} className="studio-quiz-option"><input type="radio" name="correct" checked={correct === index} onChange={() => setCorrect(index)} aria-label={`Correcta ${index + 1}`} /><input aria-label={`Opción ${index + 1}`} required maxLength={120} value={option} onChange={(event) => setOptions((previous) => previous.map((item, position) => position === index ? event.target.value : item))} /></label>)}</fieldset></>}
      <button type="submit" className="studio-primary-button" disabled={runtime.busy || dialog === 'rooms' && !participants}>Guardar en Learning</button><p role="status">{notice}</p>
    </form></StudioDialog>}
  </aside>;
}
