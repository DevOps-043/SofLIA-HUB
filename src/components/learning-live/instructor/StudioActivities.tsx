import { useRef, useState, type FormEvent } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioDialog } from './StudioDialog';
import { StudioClock } from './StudioClock';
import { StudioNumberField } from './StudioNumberField';
import SelectDropdown from '../../ui/SelectDropdown';
import type { StudioResource, StudioRoom } from './studio-types';

export function StudioActivities({ initialResources = [], participants, rooms, onRoomsChange }: { initialResources?: StudioResource[]; participants: number; rooms: StudioRoom[]; onRoomsChange: (rooms: StudioRoom[]) => void }) {
  const [resources, setResources] = useState(initialResources);
  const [dialog, setDialog] = useState<'rooms' | 'quiz' | null>(null);
  const [roomMode, setRoomMode] = useState<'size' | 'count'>('size');
  const [roomValue, setRoomValue] = useState(4);
  const [roomParticipants, setRoomParticipants] = useState(participants);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '']);
  const [answer, setAnswer] = useState(0);
  const [quiz, setQuiz] = useState<{ question: string; options: string[]; answer: number } | null>(null);
  const [resourceKind, setResourceKind] = useState<StudioResource['kind']>('file');
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const count = roomParticipants > 0 ? Math.min(roomParticipants, roomMode === 'size' ? Math.ceil(roomParticipants / roomValue) : roomValue) : 0;
  function createRooms(event: FormEvent) {
    event.preventDefault();
    if (!count) return;
    onRoomsChange(Array.from({ length: count }, (_, index) => ({ id: crypto.randomUUID(), name: `Sala ${index + 1}`, participants: Math.floor(roomParticipants / count) + (index < roomParticipants % count ? 1 : 0) })));
    setDialog(null); setNotice(`${count} salas preparadas en el diseño.`);
  }
  function createQuiz(event: FormEvent) {
    event.preventDefault();
    const trimmed = options.map((option) => option.trim());
    if (!question.trim() || trimmed.some((option) => !option) || new Set(trimmed).size !== trimmed.length) { setNotice('Escribe una pregunta y respuestas distintas.'); return; }
    setQuiz({ question: question.trim(), options: trimmed, answer }); setDialog(null); setNotice('Quiz preparado en el diseño.');
  }
  return <aside className="studio-panel studio-activities" aria-label="Actividades y recursos"><header className="studio-panel-heading"><h2><LiveIcon name="grid" />Tu caja de herramientas</h2></header><div className="studio-activities-content">
    <div className="studio-section-caption"><span>ACTIVIDADES</span><span>Diseña el siguiente paso</span></div>
    <button className="studio-activity-card" onClick={() => setDialog('rooms')}><span className="studio-tool-icon"><LiveIcon name="users" /></span><span><strong>Salas de práctica</strong><small>Aprender haciendo, en equipo.</small></span><LiveIcon name="plus" /></button>
    {rooms.length > 0 && <section className="studio-prepared-activity" aria-label="Salas preparadas"><div><strong>{rooms.length} salas preparadas</strong><button className="studio-icon-button" aria-label="Quitar salas del diseño" onClick={() => onRoomsChange([])}><LiveIcon name="close" /></button></div><div className="studio-room-grid">{rooms.slice(0, 6).map((room) => <span key={room.id}>{room.name}<small><LiveIcon name="users" />{room.participants}</small></span>)}{rooms.length > 6 && <small>+{rooms.length - 6} salas</small>}</div><small>Asignación simulada · sin salas reales</small></section>}
    <StudioClock />
    <section className="studio-resources" aria-label="Material de la sesión"><div className="studio-section-caption"><span>MATERIAL DE LA SESIÓN</span><span>{resources.length}</span></div><div className="studio-resource-actions"><button onClick={() => { setResourceKind('file'); fileInput.current?.click(); }}><LiveIcon name="plus" />Archivo</button><button onClick={() => { setResourceKind('reading'); fileInput.current?.click(); }}><LiveIcon name="book" />Lectura</button></div><input ref={fileInput} className="studio-sr-only" type="file" aria-label="Elegir material local" accept=".pdf,.docx,.pptx,.txt,.md,.epub,.json" multiple onChange={(event) => {
      const selected = Array.from(event.target.files ?? []);
      if (selected.some((file) => file.size > 25 * 1024 * 1024) || selected.length + resources.length > 20) { setNotice('Añade hasta 20 archivos, de máximo 25 MB cada uno.'); event.target.value = ''; return; }
      setResources((previous) => [...previous, ...selected.map((file) => ({ id: crypto.randomUUID(), name: file.name, detail: `${resourceKind === 'quiz' ? 'Quiz · ' : ''}${file.size < 1024 * 1024 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`} · solo local`, kind: resourceKind }))]);
      setNotice(resourceKind === 'quiz' ? 'Quiz añadido al diseño. No se ha subido.' : 'Material añadido al diseño. No se ha subido.'); event.target.value = '';
    }} />
    <div className="studio-quiz-material"><span><LiveIcon name="quiz" /><strong>Quizzes</strong></span><button onClick={() => setDialog('quiz')}><LiveIcon name="plus" />Crear quiz</button><button onClick={() => { setResourceKind('quiz'); fileInput.current?.click(); }}><LiveIcon name="file" />Subir quiz</button></div>
    {quiz && <div className="studio-prepared-activity" aria-label="Quiz preparado"><div><strong><LiveIcon name="quiz" />Quiz preparado</strong><button className="studio-icon-button" aria-label="Quitar quiz del diseño" onClick={() => setQuiz(null)}><LiveIcon name="close" /></button></div><p>{quiz.question}</p><small>{quiz.options.length} respuestas · sin publicar</small></div>}
    <div className="studio-resource-list">{resources.map((resource) => <article key={resource.id}><span className="studio-resource-icon"><LiveIcon name={resource.kind === 'reading' ? 'book' : resource.kind === 'quiz' ? 'quiz' : 'file'} /></span><div><strong title={resource.name}>{resource.name}</strong><small>{resource.detail}</small></div><button className="studio-icon-button" aria-label={`Quitar ${resource.name}`} onClick={() => setResources((previous) => previous.filter((item) => item.id !== resource.id))}><LiveIcon name="close" /></button></article>)}{resources.length === 0 && <p className="studio-muted">Prepara los archivos y lecturas que verá tu grupo.</p>}</div><p className="studio-material-note"><LiveIcon name="file" />La publicación al grupo se conectará después.</p></section>
    <div className="studio-activity-notice" role="status">{notice}</div>
  </div>
  {dialog === 'rooms' && <StudioDialog title="Preparar salas de práctica" onClose={() => setDialog(null)}><p className="studio-muted">Define cómo se distribuiría el grupo.</p><form onSubmit={createRooms}><div className="studio-field-label"><span>Participantes de ejemplo</span><StudioNumberField label="Participantes de ejemplo" min={1} max={500} required allowEmpty value={roomParticipants} onChange={setRoomParticipants} /></div><label htmlFor="studio-room-mode">Distribuir por<SelectDropdown id="studio-room-mode" aria-label="Distribuir por" className="studio-select" value={roomMode} onChange={(value) => { setRoomMode(value as typeof roomMode); setRoomValue(4); }} options={[{ value: 'size', label: 'Participantes por sala' }, { value: 'count', label: 'Número de salas' }]} /></label><div className="studio-field-label"><span>{roomMode === 'size' ? 'Personas en cada sala' : 'Cantidad de salas'}</span><StudioNumberField label={roomMode === 'size' ? 'Personas en cada sala' : 'Cantidad de salas'} min={1} max={50} required value={roomValue} onChange={setRoomValue} /></div><div className="studio-room-summary"><LiveIcon name="users" /><strong>{count} salas</strong><span>{roomParticipants} participantes · distribución automática</span></div><button type="submit" className="studio-primary-button" disabled={!count}>Preparar salas</button></form></StudioDialog>}
  {dialog === 'quiz' && <StudioDialog title="Crear un quiz rápido" onClose={() => setDialog(null)}><form onSubmit={createQuiz}><label>Tu pregunta<input autoFocus maxLength={300} required placeholder="¿Qué idea te llevas de esta sesión?" value={question} onChange={(event) => setQuestion(event.target.value)} /></label><fieldset><legend>Respuestas · selecciona la correcta</legend>{options.map((option, index) => <label className="studio-quiz-option" key={index}><input type="radio" name="correct-answer" aria-label={`Respuesta correcta ${index + 1}`} checked={answer === index} onChange={() => setAnswer(index)} /><input aria-label={`Opción ${index + 1}`} required maxLength={120} placeholder={`Opción ${index + 1}`} value={option} onChange={(event) => setOptions((previous) => previous.map((value, item) => item === index ? event.target.value : value))} /></label>)}</fieldset><p className="studio-muted">Quedará preparado en esta vista, sin publicarse.</p><button type="submit" className="studio-primary-button">Preparar quiz</button><p role="status">{notice}</p></form></StudioDialog>}
  </aside>;
}
