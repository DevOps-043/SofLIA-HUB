import { useState } from 'react';
import { Users } from './activity-icons';
import { agentActivityService } from '../../services/agent-activity';
export function AgentActivityButton() {
  const [error, setError] = useState('');
  if (!window.agentActivity) return null;
  return <div className="fixed right-40 top-1 z-[100]" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
    <button title="Ver equipos de agentes" aria-label="Ver equipos de agentes" className="rounded-lg bg-card px-2 py-1 text-secondary shadow-sm hover:text-accent focus-visible:ring-2 focus-visible:ring-accent" onClick={() => {
      setError(''); void agentActivityService.control('show').catch(() => setError('No se pudo abrir el monitor.'));
    }}><Users size={17} /></button>
    {error && <p role="alert" className="absolute right-0 top-9 w-56 rounded-lg border border-border bg-card p-2 text-xs text-danger">{error}</p>}
  </div>;
}
