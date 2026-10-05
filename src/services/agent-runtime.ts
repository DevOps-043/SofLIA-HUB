import type { AgentReply, AgentRuntimeBridge } from '../shared/agent-runtime';
declare global { interface Window { agentRuntime?: AgentRuntimeBridge } }
export function agentRuntimeBridge(): AgentRuntimeBridge {
  if (!window.agentRuntime) throw new Error('El arnés requiere la aplicación de escritorio.');
  return window.agentRuntime;
}
export async function agentResult<T>(reply: Promise<AgentReply<T>>): Promise<T> {
  const result = await reply;
  if (!result.success) throw new Error(result.error);
  return result.data;
}
