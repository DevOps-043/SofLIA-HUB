import type { BackgroundAgent, BackgroundJob } from '../../src/shared/background-teams';
import type { PresentationDeck } from '../../src/shared/presentations/deck-schema';
export interface BackgroundPresentation {
  acquire(job: BackgroundJob): Promise<void>;
  release(job: BackgroundJob): void;
  call(job: BackgroundJob, name: string, args: unknown, guard: () => Promise<void>, generateImage?: (prompt: string) => Promise<string>): Promise<string>;
  verify(job: BackgroundJob, guard: () => Promise<void>): Promise<{
    deck: PresentationDeck; imagePath(relative: string): Promise<string | null>; theme?: unknown;
  }>;
}
export type ExecutorTool = { name: string; description: string; inputSchema: Record<string, unknown> };
export interface ExecutorInput {
  job: BackgroundJob; agent: BackgroundAgent; signal: AbortSignal; tools: ExecutorTool[];
  callTool(name: string, args: unknown): Promise<string>;
  beforeCall(): Promise<void>; usage(tokens: number): void;
}
export interface BackgroundProvider {
  execute(input: ExecutorInput): Promise<string>;
  research(query: string, signal: AbortSignal): Promise<{ text: string; tokens: number }>;
  generateImage?(prompt: string, signal: AbortSignal): Promise<{ dataUrl: string; tokens: number }>;
}
export function assertExecuting(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('Trabajo interrumpido.');
}

