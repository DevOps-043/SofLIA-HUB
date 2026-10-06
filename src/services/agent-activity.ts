import type { AgentActivity, AgentActivityBridge } from '../shared/agent-activity';
import { activityFromTeam } from '../shared/agent-activity';
import type { TeamEvent } from '../shared/agent-teams/runner';
declare global { interface Window { agentActivity?: AgentActivityBridge } }
export const agentActivityService = {
  async snapshot(): Promise<AgentActivity[]> {
    if (!window.agentActivity) return [];
    const reply = await window.agentActivity.snapshot();
    if (!reply.success) throw new Error(reply.error);
    return reply.data;
  },
  subscribe(listener: (items: AgentActivity[]) => void): () => void {
    return window.agentActivity?.onChanged(listener) ?? (() => {});
  },
};
export function publishTeamActivity(event: TeamEvent, ownerId?: string): void {
  if (!ownerId || !window.agentActivity) return;
  void window.agentActivity.publish({ ownerId, activity: activityFromTeam(event) }).catch(() => {
    console.warn('[Equipo] No se pudo notificar la actividad al monitor.');
  });
}
