import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgentActivity } from '../../shared/agent-activity';
import { agentActivityService } from '../../services/agent-activity';
import { AgentActivityContext, hasFilePanelContent, hasNewRunningTeam, type AgentActivityPanelState } from './agent-activity-context';
import { useAuth } from '../../contexts/AuthContext';
import { useBackgroundTeams } from './useBackgroundTeams';

/** Mantiene una única suscripción al monitor para el panel y sus botones de acceso. */
export function AgentActivityProvider({ children }: { children: ReactNode }) {
  const { user, sofiaContext } = useAuth();
  const organizationId = sofiaContext?.currentOrganization?.id ?? null;
  return <ScopedActivityProvider key={(user?.id ?? 'sin-sesion') + ':' + organizationId} ownerId={user?.id} organizationId={organizationId}>{children}</ScopedActivityProvider>;
}

function ScopedActivityProvider({ children, ownerId, organizationId }: { children: ReactNode; ownerId?: string; organizationId: string | null }) {
  const background = useBackgroundTeams(ownerId, organizationId);
  const [items, setItems] = useState<AgentActivity[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const knownIdsRef = useRef<ReadonlySet<string>>(new Set());

  const receive = useCallback((next: AgentActivity[]) => {
    if (hasNewRunningTeam(knownIdsRef.current, next)) setOpen(true);
    knownIdsRef.current = new Set(next.filter(hasFilePanelContent).map(item => item.id));
    setItems(next);
  }, []);

  useEffect(() => {
    let active = true;
    const remove = agentActivityService.subscribe(next => { if (active) receive(next); }, ownerId, nextError => { if (active) setError(nextError); });
    return () => { active = false; remove(); };
  }, [receive, ownerId]);

  const toggle = useCallback(() => setOpen(current => !current), []);
  const allItems = useMemo(() => [...background.activities, ...items].filter(hasFilePanelContent).sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running')), [background.activities, items]);
  const backgroundKnown = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (hasNewRunningTeam(backgroundKnown.current, background.activities)) setOpen(true);
    backgroundKnown.current = new Set(background.activities.filter(hasFilePanelContent).map(item => item.id));
  }, [background.activities]);
  const runningCount = allItems.filter(item => item.status === 'running').length;
  const value = useMemo<AgentActivityPanelState>(
    () => ({ items: allItems, error: error || background.error, open, runningCount, setOpen, toggle }),
    [allItems, error, background.error, open, runningCount, toggle],
  );
  return <AgentActivityContext.Provider value={value}>{children}</AgentActivityContext.Provider>;
}
