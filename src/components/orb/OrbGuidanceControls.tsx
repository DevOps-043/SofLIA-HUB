import type { GuidanceControl, GuidanceState, GuidanceStyle } from '../../shared/orb-guidance';
import './orb-guidance.css';

export function OrbGuidanceControls({ state, error, control, check }: {
  state: GuidanceState; error: string | null;
  control: (input: GuidanceControl) => Promise<void>; check: () => Promise<void>;
}) {
  return <section className="orb-guidance-controls" aria-label="Asistencia visual de SofLIA">
    <div className="orb-guidance-instruction" role="status" aria-live="polite">
      {state.practice && <small>{state.practice.title} · {state.practice.step}/{state.practice.total}</small>}
      <p>{state.phase === 'paused' ? 'Asistencia pausada' : state.instruction || 'Asistencia visual'}</p>
      {(error || state.message) && <small role={error ? 'alert' : undefined}>{error || state.message}</small>}
    </div>
    <div className="orb-guidance-actions">
      {state.phase !== 'complete' && <button type="button" onClick={() => { void control({ action: state.phase === 'paused' ? 'resume' : 'pause' }); }}>{state.phase === 'paused' ? 'Reanudar' : 'Pausar'}</button>}
      <button type="button" onClick={() => { void control({ action: 'stop' }); }}>{state.phase === 'complete' ? 'Cerrar' : 'Detener'}</button>
    </div>
    {state.practice && state.phase !== 'complete' && <button type="button" className="orb-guidance-check" disabled={state.phase === 'paused' || state.phase === 'verifying'} onClick={() => { void check(); }}>{state.phase === 'verifying' ? 'Comprobando…' : 'Comprobar paso'}</button>}
    <label className="orb-guidance-style">Señalar con<select value={state.style} onChange={event => { void control({ action: 'style', style: event.target.value as GuidanceStyle }); }}>
      <option value="frame">Marco</option><option value="halo">Halo</option><option value="arrow">Flecha</option><option value="focus">Foco</option>
    </select></label>
  </section>;
}
