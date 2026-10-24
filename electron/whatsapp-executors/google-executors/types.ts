import type { FunctionResponse, ToolExecutorContext } from '../types';

export type GoogleExecutorResult = {
  response: FunctionResponse;
};

export type GoogleExecutor = (
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
) => Promise<GoogleExecutorResult | null>;
