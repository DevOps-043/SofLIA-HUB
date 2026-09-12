import { useEffect, useRef, useState } from 'react';
import { integratedBrowserService } from '../../services/integrated-browser-service';
import type { BrowserAgentTaskState, BrowserAgentControlAction } from '../../shared/browser-agent-control';

const labels: Record<BrowserAgentTaskState['status'], string> = {
  starting: 'SofLIA está preparando la tarea', executing: 'SofLIA controla esta vista',
  pausing: 'Pausando: esperando la operación en curso', paused: 'Tarea pausada',
  stopping: 'Deteniendo: esperando liberar el navegador',
};
type Props = { task: BrowserAgentTaskState; profileRevision?: number };
export function BrowserAgentTaskControls(props: Props) {
  // Un cambio autoritativo invalida acuses tardíos sin reemplazar el estado de main.
  return <ControlSession key={`${props.profileRevision}:${props.task.taskId}:${props.task.revision}:${props.task.status}`} {...props} />;
}
function ControlSession({ task, profileRevision }: Props) {
  const [pending, setPending] = useState<BrowserAgentControlAction | null>(null);
  const [error, setError] = useState('');
  const request = useRef<BrowserAgentControlAction | null>(null);
  const epoch = useRef(0);
  useEffect(() => () => { epoch.current += 1; }, []);
  const stopping = pending === 'stop' || pending === 'take-control' || task.status === 'stopping';
  const send = async (action: BrowserAgentControlAction) => {
    const stop = action === 'stop' || action === 'take-control';
    if (profileRevision === undefined || task.status === 'stopping'
      || request.current === 'stop' || request.current === 'take-control' || (request.current && !stop)) return;
    request.current = action;
    const version = ++epoch.current;
    setPending(action); setError('');
    try {
      const response = await integratedBrowserService.controlAgentTask({ action, taskId: task.taskId, taskRevision: task.revision, profileRevision });
      if (epoch.current !== version) return;
      if (!response.success) throw new Error('Solicitud rechazada.');
      // El acuse confirma recepción, no que terminó la operación nativa.
    } catch {
      if (epoch.current !== version) return;
      request.current = null; setPending(null);
      setError('No se pudo cambiar la ejecución. Revisa el estado e inténtalo de nuevo.');
    }
  };
  return <div className="flex flex-col gap-1 px-1 text-xs" aria-label="Supervisión del agente">
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" className="font-semibold text-accent">{labels[task.status]}</span>
      <span>Pasos: {task.currentStep}/{task.maxSteps}</span>
      {task.status === 'executing' && <button type="button" className="soflia-browser-button px-3" disabled={!!pending || profileRevision === undefined} onClick={() => void send('pause')}>Pausar</button>}
      {task.status === 'paused' && <button type="button" className="soflia-browser-button px-3" disabled={!!pending || profileRevision === undefined} onClick={() => void send('resume')}>Reanudar</button>}
      <button type="button" className="soflia-browser-button px-3" disabled={stopping || profileRevision === undefined} onClick={() => void send('stop')}>Detener</button>
      <button type="button" className="soflia-browser-button px-3" disabled={stopping || profileRevision === undefined} onClick={() => void send('take-control')}>Tomar control</button>
    </div>
    {task.status === 'paused' && <p>Al reanudar se observará de nuevo la página. Tomar control cancela esta tarea.</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
  </div>;
}
