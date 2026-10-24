import { useEffect, useState } from 'react';
import { useStudioRuntime } from './StudioRuntimeContext';
import { StudioNumberField } from './StudioNumberField';
import { LiveIcon } from '../LiveIcon';

export function StudioLiveClock({ compact = false }: { compact?: boolean }) {
  const runtime = useStudioRuntime()!;
  const clock = runtime.snapshot.state.clock;
  const [minutes, setMinutes] = useState(5);
  const [serverNow, setServerNow] = useState(() => Date.parse(runtime.snapshot.server_time));
  useEffect(() => {
    if (!clock?.running) return;
    const start = performance.now(); const base = Date.parse(runtime.snapshot.server_time);
    const timer = window.setInterval(() => setServerNow(base + performance.now() - start), 250);
    return () => window.clearInterval(timer);
  }, [clock?.running, runtime.snapshot.server_time]);
  const elapsed = clock?.running ? Math.max(0, Math.floor((serverNow - Date.parse(clock.updated_at)) / 1000)) : 0;
  const seconds = clock ? clock.mode === 'timer' ? Math.max(0, clock.seconds - elapsed) : clock.seconds + elapsed : minutes * 60;
  const manage = runtime.snapshot.can_manage;
  function update(mode: 'timer' | 'stopwatch', value: number, running: boolean) { void runtime.send({ type: 'clock', clock: { mode, seconds: Math.min(86400, value), running } }); }
  if (compact) return clock ? <span className="participant-clock" aria-label="Tiempo de actividad"><LiveIcon name="clock" />{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}{clock.mode === 'timer' ? ' restantes' : ' transcurridos'}</span> : null;
  return <section className="studio-clock" aria-label="Reloj sincronizado"><div className="studio-small-tabs"><button disabled={!manage || runtime.busy} aria-pressed={!clock || clock.mode === 'timer'} onClick={() => update('timer', minutes * 60, false)}>Temporizador</button><button disabled={!manage || runtime.busy} aria-pressed={clock?.mode === 'stopwatch'} onClick={() => update('stopwatch', 0, false)}>Cronómetro</button></div><div className="studio-clock-controls"><output aria-label="Tiempo de actividad">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</output>{manage && <><button className="studio-icon-button" aria-label={clock?.running ? 'Pausar reloj' : 'Iniciar reloj'} disabled={runtime.busy || clock?.mode === 'timer' && seconds === 0} onClick={() => update(clock?.mode ?? 'timer', seconds, !clock?.running)}><LiveIcon name={clock?.running ? 'pause' : 'play'} /></button><button className="studio-icon-button" aria-label="Reiniciar reloj" disabled={runtime.busy} onClick={() => update(clock?.mode ?? 'timer', clock?.mode === 'stopwatch' ? 0 : minutes * 60, false)}><LiveIcon name="refresh" /></button></>}</div>{manage && (!clock || clock.mode === 'timer') && <StudioNumberField label="Duración en minutos" min={1} max={180} compact value={minutes} onChange={setMinutes} disabled={clock?.running} />}<small>Reloj sincronizado con Learning</small></section>;
}
