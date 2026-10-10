import type { TeamEvent } from './agent-teams/runner';
export type ActivityAgentState = 'pending' | 'running' | 'completed' | 'failed' | 'timed_out' | 'cancelled' | 'skipped';
export interface AgentActivity {
  id: string; sequence: number;
  surface: 'chat' | 'orb' | 'whatsapp' | 'browser' | 'computer' | 'meetings';
  kind: 'analysis' | 'document' | 'presentation' | 'browser' | 'computer' | 'meeting';
  status: 'running' | 'completed' | 'partial' | 'unavailable' | 'cancelled';
  agents: Array<{ role: string; status: ActivityAgentState }>;
  durationMs: number;
}
export type ActivityReply = { success: true; data: AgentActivity[] } | { success: false; error: string };
export interface AgentActivityBridge {
  snapshot(): Promise<ActivityReply>;
  publish(input: { ownerId: string; activity: AgentActivity }): Promise<ActivityReply>;
  onChanged(listener: (items: AgentActivity[]) => void): () => void;
}
export function activityFromTeam(event: TeamEvent): AgentActivity {
  return { id: event.runId, sequence: event.sequence, surface: event.surface, kind: event.kind,
    status: event.status === 'started' || event.status === 'updated' ? 'running' : event.status,
    agents: event.agents.map(agent => ({ ...agent })), durationMs: event.durationMs };
}
