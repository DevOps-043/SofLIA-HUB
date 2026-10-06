import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentActivity } from '../../shared/agent-activity';
import { agentActivityService } from '../../services/agent-activity';
import { AgentActivityContext, hasNewRunningTeam, type AgentActivityPanelState } from './agent-activity-context';

/** Mantiene una única suscripción al monitor para el panel y sus botones de acceso. */
export function AgentActivityProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AgentActivity[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const knownIdsRef = useRef<ReadonlySet<string>>(new Set());

  const receive = useCallback((next: AgentActivity[]) => {
    if (hasNewRunningTeam(knownIdsRef.current, next)) setOpen(true);
    knownIdsRef.current = new Set(next.map(item => item.id));
    setError('');
    setItems(next);
  }, []);

  useEffect(() => {
    let active = true; let changed = false;
    const remove = agentActivityService.subscribe(next => { changed = true; if (active) receive(next); });
    void agentActivityService.snapshot().then(next => { if (active && !changed) receive(next); }).catch(() => {
      if (active) setError('No se pudo cargar la actividad de los equipos.');
    });
    return () => { active = false; remove(); };
  }, [receive]);

  const toggle = useCallback(() => setOpen(current => !current), []);
  const runningCount = items.filter(item => item.status === 'running').length;
  const value = useMemo<AgentActivityPanelState>(
    () => ({ items, error, open, runningCount, setOpen, toggle }),
    [items, error, open, runningCount, toggle],
  );
  return <AgentActivityContext.Provider value={value}>{children}</AgentActivityContext.Provider>;
}
