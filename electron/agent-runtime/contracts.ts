import type { AgentRole, AgentRun, AgentScope, AgentStep } from '../../src/shared/agent-runtime';
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
export interface AgentInvocation {
  role: AgentRole;
  prompt: string;
  signal: AbortSignal;
  tools: ToolDefinition[];
  callTool(name: string, args: unknown): Promise<string>;
}
export interface AgentProvider {
  execute(input: AgentInvocation): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
}
export interface RunRepository {
  encrypted: boolean;
  load(scope: AgentScope): AgentRun[];
  save(scope: AgentScope, runs: AgentRun[]): void;
}
export const createSteps = (): AgentStep[] => (['acuerdos', 'evidencia', 'coordinador'] as const).map(role => ({
  role, status: 'pending', output: '', inputTokens: 0, outputTokens: 0, toolCalls: 0,
}));
export function sameScope(a: AgentScope, b: AgentScope): boolean {
  return a.userId === b.userId && a.organizationId === b.organizationId;
}
export function assertActive(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('La ejecución fue interrumpida.');
}
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void promise.catch(() => undefined); return Promise.reject(new Error('Ejecución interrumpida.')); }
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new Error('Ejecución interrumpida.'));
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}
