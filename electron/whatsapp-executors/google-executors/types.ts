import type { FunctionResponse, ToolExecutorContext } from '../types';

export type GoogleExecutorResult = {
  response: FunctionResponse;
  bulkLabelsToVerify: Set<string> | null;
};

export type GoogleExecutor = (
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  bulkLabelsToVerify: Set<string> | null,
) => Promise<GoogleExecutorResult | null>;
