import { useEffect, useState } from 'react';
import { LiveIcon } from '../LiveIcon';
import { StudioNumberField } from './StudioNumberField';

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
export function StudioClock() {
  const [mode, setMode] = useState<'timer' | 'stopwatch'>('timer');
  const [minutes, setMinutes] = useState(5);
  const [{ seconds, running }, setClock] = useState({ seconds: 300, running: false });
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setClock((previous) => {
      const next = mode === 'timer' ? Math.max(0, previous.seconds - 1) : previous.seconds + 1;
      return { seconds: next, running: mode === 'stopwatch' || next > 0 };
    }), 1000);
    return () => window.clearInterval(interval);
  }, [running, mode]);
  const finished = mode === 'timer' && seconds === 0;
  function changeMode(next: typeof mode) { setMode(next); setClock({ running: false, seconds: next === 'timer' ? minutes * 60 : 0 }); }
  return <section className="studio-clock" aria-label="Reloj de actividades"><div className="studio-small-tabs"><button aria-pressed={mode === 'timer'} onClick={() => changeMode('timer')}>Temporizador</button><button aria-pressed={mode === 'stopwatch'} onClick={() => changeMode('stopwatch')}>Cronómetro</button></div><div className="studio-clock-controls"><output aria-label="Tiempo de actividad">{formatTime(seconds)}</output><button className="studio-icon-button" aria-label={running ? 'Pausar reloj' : 'Iniciar reloj'} disabled={finished} onClick={() => setClock((previous) => ({ ...previous, running: !previous.running }))}><LiveIcon name={running ? 'pause' : 'play'} /></button><button className="studio-icon-button" aria-label="Reiniciar reloj" onClick={() => setClock({ running: false, seconds: mode === 'timer' ? minutes * 60 : 0 })}><LiveIcon name="refresh" /></button></div>{mode === 'timer' && <div className="studio-timer-duration"><span>Duración</span><StudioNumberField label="Duración en minutos" compact min={1} max={180} value={minutes} disabled={running} onChange={(value) => { setMinutes(value); setClock({ running: false, seconds: value * 60 }); }} /><span>min</span></div>}{finished && <p role="status">Tiempo terminado</p>}<small>Reloj local de la actividad</small></section>;
}
