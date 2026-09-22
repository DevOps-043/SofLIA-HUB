export type AgentProviderId = 'gemini' | 'codex';
export type AgentRole = 'acuerdos' | 'evidencia' | 'coordinador';
export type AgentRunStatus = 'running' | 'review' | 'cancelled' | 'failed' | 'interrupted' | 'publishing' | 'published' | 'uncertain';
export interface AgentScope { userId: string; organizationId: string | null }
export interface AgentStep {
  role: AgentRole;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}
export interface AgentRun {
  id: string;
  scope: AgentScope;
  title: string;
  source: string;
  provider: AgentProviderId;
  status: AgentRunStatus;
  steps: AgentStep[];
  createdAt: string;
  updatedAt: string;
  error: string | null;
  digest: string | null;
  approvalExpiresAt: number | null;
  meetingRunId: string | null;
  parentRunId: string | null;
}
export interface AgentRuntimeState {
  scope: AgentScope;
  runs: AgentRun[];
  persistence: 'encrypted' | 'volatile';
  codex: { configured: boolean; version: string | null; home: string | null };
  geminiAvailable: boolean;
}
export interface AgentStartInput { title: string; source: string; provider: AgentProviderId }
export type AgentReply<T> = { success: true; data: T } | { success: false; error: string };
export interface AgentRuntimeBridge {
  releaseContext(): Promise<AgentReply<null>>;
  setContext(input: { organizationId: string | null }): Promise<AgentReply<AgentRuntimeState>>;
  getState(): Promise<AgentReply<AgentRuntimeState>>;
  start(input: AgentStartInput): Promise<AgentReply<AgentRun>>;
  cancel(input: { runId: string }): Promise<AgentReply<AgentRun>>;
  recover(input: { runId: string }): Promise<AgentReply<AgentRun>>;
  publish(input: { runId: string; digest: string }): Promise<AgentReply<AgentRun>>;
  configureCodex(): Promise<AgentReply<AgentRuntimeState>>;
  setCodexKey(input: { apiKey: string }): Promise<AgentReply<AgentRuntimeState>>;
  onChanged(callback: () => void): () => void;
}
export const AGENT_LIMITS = {
  sourceChars: 80_000, outputChars: 24_000, titleChars: 180,
  maxCallsPerStep: 6, maxToolsPerStep: 12, maxOutputTokens: 3_000,
  runTimeoutMs: 180_000, rpcTimeoutMs: 30_000, approvalTtlMs: 600_000,
  historyRuns: 20, maxFrameBytes: 2_000_000,
} as const;
