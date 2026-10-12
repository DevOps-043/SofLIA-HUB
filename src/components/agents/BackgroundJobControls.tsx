import { useState } from 'react';
import { backgroundFailureMessage } from '../../shared/background-team-display';
import { backgroundTeamsService } from '../../services/background-teams';
import type { AgentActivity } from '../../shared/agent-activity';
import { TeamFiles } from './TeamFiles';
import './team-results.css';

export function BackgroundJobControls({ execution }: { execution: NonNullable<AgentActivity['execution']> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  };
  const active = ['queued', 'running', 'verifying'].includes(execution.status);
  return <div className="team-panel-controls">
    {execution.status === 'failed' && <p className="team-operation-error">{backgroundFailureMessage(execution.error)}</p>}
    <div className="team-control-actions">
      {active && <button disabled={busy} type="button" onClick={() => void run(() => backgroundTeamsService.control(execution.id, 'pause'))}>Pausar trabajo</button>}
      {['paused', 'failed', 'interrupted'].includes(execution.status) && <button disabled={busy} type="button" onClick={() => void run(() => backgroundTeamsService.control(execution.id, 'resume'))}>Reanudar trabajo</button>}
      {!['completed', 'cancelled'].includes(execution.status) && <button disabled={busy} type="button" onClick={() => void run(() => backgroundTeamsService.control(execution.id, 'cancel'))}>Cancelar trabajo</button>}
    </div>
    {execution.artifacts.length > 0 && <TeamFiles jobId={execution.id} files={execution.artifacts} compact />}
    {error && <p role="alert" className="team-operation-error">{error}</p>}
  </div>;
}

