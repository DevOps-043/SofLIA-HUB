import { useState } from 'react';
import { useStudioRuntime } from './instructor/StudioRuntimeContext';
import { useStudioMediaRuntime } from './instructor/StudioMediaContext';
import { StudioChat } from './instructor/StudioChat';
import { StudioSceneCanvas } from './instructor/StudioSceneCanvas';
import { StudioLiveClock } from './instructor/StudioLiveClock';

export function ParticipantStudio({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const runtime = useStudioRuntime()!;
  const media = useStudioMediaRuntime()!;
  const { state, user_id } = runtime.snapshot;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const currentRoomId = state.members.find((member) => member.user_id === user_id)?.room_id ?? null;
  const room = state.rooms.find((entry) => entry.id === currentRoomId);
  const scene = state.scenes.find((entry) => entry.id === state.active_scene_id);
  const quiz = state.quizzes.find((entry) => entry.id === state.active_quiz_id);
  return <section className="instructor-studio" aria-label="Aula del participante"><header className="studio-topbar"><button onClick={onBack}>Volver</button><h1>{runtime.snapshot.title}</h1><span>{runtime.realtime}</span><button disabled={media.zoomPending || media.zoomConnected} onClick={media.connectZoom}>{media.zoomConnected ? 'Zoom conectado' : 'Unirme a Zoom'}</button><button onClick={onClose}>Salir</button></header><div className="studio-participant-layout">
    <StudioChat room={room ? { id: room.id, name: room.name, participants: room.user_ids.length } : null} />
    <main className="studio-production" aria-label="Contenido de la sesión">{media.zoomStage}{scene && <div className="studio-video-frame"><StudioSceneCanvas key={scene.id} scene={{ ...scene, assetUrl: scene.asset_path ? runtime.snapshot.asset_urls[scene.asset_path] : undefined }} /></div>}{!scene && !media.zoomStage && <p>El instructor aún no ha seleccionado una escena.</p>}<StudioLiveClock />{state.rooms.filter((entry) => entry.user_ids.includes(user_id)).map((entry) => <button disabled={runtime.busy || entry.id === currentRoomId} key={entry.id} onClick={() => void runtime.send({ type: 'presence', room_id: entry.id })}>Entrar al chat de {entry.name}</button>)}{currentRoomId && <button onClick={() => void runtime.send({ type: 'presence', room_id: null })}>Volver al chat principal</button>}</main>
    <aside className="studio-panel studio-live-assets" aria-label="Material y actividades"><h2>Material de la sesión</h2>{state.materials.map((material) => runtime.snapshot.asset_urls[material.asset_path] ? <a key={material.id} href={runtime.snapshot.asset_urls[material.asset_path]} target="_blank" rel="noopener noreferrer">{material.name}</a> : <p key={material.id}>{material.name} · no disponible</p>)}
      {quiz && <section><h3>{quiz.question}</h3>{state.answers.some((answer) => answer.quiz_id === quiz.id && answer.user_id === user_id) ? <p>Respuesta guardada.</p> : quiz.options.map((option, index) => <button key={index} disabled={runtime.busy} onClick={() => void runtime.send({ type: 'answer_quiz', quiz_id: quiz.id, answer: index })}>{option}</button>)}</section>}
      {state.practices.map((practice) => <form key={practice.id} onSubmit={(event) => { event.preventDefault(); void runtime.send({ type: 'submit_practice', practice_id: practice.id, content: drafts[practice.id] ?? '' }); }}><h3>{practice.title}</h3><p>{practice.instructions}</p><textarea required maxLength={2000} aria-label={`Entrega de ${practice.title}`} value={drafts[practice.id] ?? ''} onChange={(event) => setDrafts({ ...drafts, [practice.id]: event.target.value })} /><button disabled={runtime.busy}>Guardar entrega</button>{state.submissions.some((submission) => submission.practice_id === practice.id && submission.user_id === user_id) && <small>Entrega guardada</small>}</form>)}
    </aside>
  </div></section>;
}
