import { useState } from 'react';
import { HOLDING_PRESETS, type StudioHolding, type StudioTransition } from '../../../shared/studio-program';
import { LiveIcon } from '../LiveIcon';
import { StudioSceneEditor } from './StudioSceneEditor';
import type { StudioPreparedScene } from './studio-types';
import type { StudioSceneDraft } from './useStudioScenes';
import type { useStudioProgram } from './useStudioProgram';
import './studio-program.css';

export function StudioProgramPanel({ program, selected, scenes, onAdd, onPreset, sharing, onStop, canvasRef, directSharing = false }: {
  program: Omit<ReturnType<typeof useStudioProgram>, 'bindCanvas'>; selected: StudioPreparedScene | null; canvasRef: (element: HTMLCanvasElement | null) => void;
  scenes: StudioPreparedScene[]; onAdd: (draft: StudioSceneDraft) => string | null | Promise<string | null>;
  onPreset: (phase: StudioHolding['phase']) => void; sharing: boolean; onStop: () => void;
  directSharing?: boolean;
}) {
  const [editor, setEditor] = useState(false);
  const active = program.state !== 'idle', visual = program.transition.effect === 'visual';
  const candidates = scenes.filter((scene) => scene.kind !== 'video');
  const intermediate = candidates.find((scene) => scene.id === program.transition.sceneId);
  const thumbnail = intermediate?.kind === 'screen' ? intermediate.capture?.thumbnail : intermediate?.kind === 'image' ? intermediate.assetUrl : undefined;
  function changeEffect(effect: StudioTransition['effect']) {
    program.setTransition(effect === 'visual'
      ? { effect, durationMs: 1500, sceneId: intermediate?.id }
      : { effect, durationMs: Math.min(2000, program.transition.durationMs) });
  }
  return <section className="studio-program-panel" aria-label="Transiciones y salida del curso">
    <header><h3>Transiciones</h3><span role="status">{program.pending ? 'Preparando cambio…' : active ? sharing ? 'Compartiendo salida' : 'Salida local preparada' : 'Salida sin preparar'}</span></header>
    <div className="studio-course-presets" role="group" aria-label="Pantallas del curso">{Object.entries(HOLDING_PRESETS).map(([phase, preset]) => <button key={phase} disabled={program.pending} onClick={() => onPreset(phase as StudioHolding['phase'])}>{preset.name}</button>)}</div>
    <div className="studio-program-controls"><label>Efecto<select aria-label="Efecto de transición" value={program.transition.effect} disabled={program.pending} onChange={(event) => changeEffect(event.target.value as StudioTransition['effect'])}><option value="cut">Corte</option><option value="fade">Fundido</option><option value="wipe">Barrido</option><option value="visual">Imagen o pantalla</option></select></label><label>{visual ? 'Intervalo (ms)' : 'Duración (ms)'}<input aria-label="Duración de transición" type="number" min={visual ? 500 : 100} max={visual ? 10000 : 2000} step={100} value={program.transition.durationMs} disabled={program.pending || program.transition.effect === 'cut'} onChange={(event) => program.setTransition({ ...program.transition, durationMs: Math.min(visual ? 10000 : 2000, Math.max(visual ? 500 : 100, Number(event.target.value) || 0)) })} /></label></div>
    {visual && <div className="studio-transition-visual">
      <div className="studio-transition-thumbnail" aria-hidden="true">{thumbnail ? <img src={thumbnail} alt="" /> : <LiveIcon name={intermediate?.kind === 'screen' ? 'screen' : 'file'} />}</div>
      <label>Contenido intermedio<select aria-label="Contenido intermedio" disabled={program.pending} value={intermediate?.id || ''} onChange={(event) => program.setTransition({ ...program.transition, sceneId: event.target.value || undefined })}><option value="">Elige una imagen o pantalla</option>{candidates.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
      <button disabled={program.pending || scenes.length >= 12} onClick={() => setEditor(true)}><LiveIcon name="plus" />Añadir visual</button>
      <small>Se muestra entre escenas. Para dejarlo visible, selecciónalo en el banco y usa Corte.</small>
    </div>}
    <div className="studio-program-monitor"><canvas ref={canvasRef} aria-label="Monitor de salida del curso" /><div><strong>PROGRAMA</strong><span>{program.programScene?.name || 'Sin escena en salida'}</span><small>Preparada: {selected?.name || 'elige una escena'}</small></div></div>
    <div className="studio-program-actions"><button className="studio-primary-button" disabled={!selected || program.pending || program.state === 'preparing' || directSharing || active && visual && (!intermediate || intermediate.id === selected?.id)} onClick={() => { if (selected) void program.take(selected, !active); }}><LiveIcon name="arrow" />{active ? 'Pasar a salida' : 'Preparar salida continua'}</button>{active && <button onClick={onStop}>Cerrar salida</button>}</div>
    {active && visual && intermediate?.id === selected?.id && <p role="status">Prepara una escena de destino distinta del contenido intermedio.</p>}
    <details className="studio-program-help"><summary>Cómo funciona la salida</summary><p>Selecciona una escena para prepararla. «Pasar a salida» publica el cambio. Después de preparar la salida, pulsa Compartir en la llamada para emitirla.</p><p>Las pantallas del curso mantienen el micrófono y la cámara de la llamada. Los videos se emiten sin sonido.</p></details>
    {directSharing && <p>Detén la pantalla compartida directa antes de preparar la salida continua.</p>}
    {program.error && <p role="alert">{program.error}</p>}
    {editor && <StudioSceneEditor initialKind="media" visualOnly onAdd={onAdd} onClose={() => setEditor(false)} />}
  </section>;
}
