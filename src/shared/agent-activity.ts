import type { TeamEvent } from './agent-teams/runner';
export type ActivityAgentState = 'pending' | 'running' | 'completed' | 'failed' | 'timed_out' | 'cancelled' | 'skipped';
export interface AgentActivity {
  id: string; sequence: number;
  surface: 'chat' | 'orb' | 'whatsapp' | 'browser' | 'computer' | 'meetings';
  kind: 'analysis' | 'document' | 'presentation' | 'browser' | 'computer' | 'meeting';
  status: 'running' | 'completed' | 'partial' | 'unavailable' | 'cancelled';
  agents: Array<{ role: string; status: ActivityAgentState; operation?: string }>;
  /** Solo el snapshot autenticado de trabajos main aporta esta extensión. */
  execution?: { id: string; status: import('./background-teams').BackgroundStatus; title: string; conversationId: string;
    messageId?: string;
    artifacts: import('./background-teams').BackgroundArtifact[]; summary: string; error: string | null; tokens: number;
    actions?: import('./background-teams').BackgroundAction[] };
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
