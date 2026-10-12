import type { BackgroundAgent, BackgroundJob } from '../../src/shared/background-teams';
export type ExecutorTool = { name: string; description: string; inputSchema: Record<string, unknown> };
export interface ExecutorInput {
  job: BackgroundJob; agent: BackgroundAgent; signal: AbortSignal; tools: ExecutorTool[];
  callTool(name: string, args: unknown): Promise<string>;
  beforeCall(): Promise<void>; usage(tokens: number): void;
}
export interface BackgroundProvider {
  execute(input: ExecutorInput): Promise<string>;
  research(query: string, signal: AbortSignal): Promise<{ text: string; tokens: number }>;
}
export function assertExecuting(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('Trabajo interrumpido.');
}

