import type { FunctionResponse } from '../types';
import { handleIrisAuthTool } from './auth-handlers';
import { handleIrisReadTool } from './read-handlers';
import { handleIrisWriteTool } from './write-handlers';
import { IRIS_TOOLS } from './tools';

export async function executeIrisTool(
  toolName: string,
  toolArgs: Record<string, any>,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (!IRIS_TOOLS.has(toolName)) return null;

  return (
    await handleIrisAuthTool(toolName, toolArgs, senderNumber) ||
    await handleIrisReadTool(toolName, toolArgs) ||
    await handleIrisWriteTool(toolName, toolArgs, senderNumber)
  );
}
