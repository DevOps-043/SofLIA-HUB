import { useEffect, useState } from 'react';
import { backgroundTeamsService } from '../../services/background-teams';
import type { BackgroundJob } from '../../shared/background-teams';
import type { AgentActivity } from '../../shared/agent-activity';

export function useBackgroundTeams(ownerId: string | undefined, organizationId: string | null) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!ownerId || !window.backgroundTeams) return;
    let active = true; let revision = 0;
    const accept = async (initial = false) => {
      const current = ++revision;
      try {
        const state = initial ? await backgroundTeamsService.context(organizationId) : await backgroundTeamsService.state().catch(failure => {
          // Restaurar la sesión main puede invalidar un contexto cargado por React.
          if (!active || current !== revision) throw failure;
          return backgroundTeamsService.context(organizationId);
        });
        if (!active || current !== revision || state.scope.userId !== ownerId || state.scope.organizationId !== organizationId) return;
        setJobs(state.jobs); setError('');
      } catch { if (active && current === revision) setError('No se pudieron cargar los trabajos del equipo.'); }
    };
    const remove = window.backgroundTeams.onChanged(() => { void accept(); });
    void accept(true);
    return () => { active = false; remove(); };
  }, [ownerId, organizationId]);
  const activities: AgentActivity[] = [...jobs].reverse().map(job => ({
    id: 'background:' + job.id, sequence: job.sequence, surface: 'chat', kind: 'document',
    status: ['queued', 'running', 'verifying'].includes(job.status) ? 'running' : job.status === 'completed' ? 'completed' : job.status === 'cancelled' ? 'cancelled' : 'partial',
    durationMs: job.activeMs,
    agents: job.agents.map(agent => ({ role: agent.role, status: agent.status, operation: agent.operation })),
    execution: { id: job.id, status: job.status, title: job.task, conversationId: job.conversationId, messageId: job.messageId, artifacts: job.artifacts, summary: job.summary, error: job.error, tokens: job.tokens, actions: job.actions },
  }));
  return { activities, error };
}

