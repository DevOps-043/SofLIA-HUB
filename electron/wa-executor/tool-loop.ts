import { dispatchTool } from './tool-dispatch';
import { evaluateToolGuards } from './tool-guards';
import type { FunctionResponse, ToolExecutorContext } from './types';

export async function executeWhatsAppTools(
  functionCalls: any[],
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<{ responses: FunctionResponse[]; bulkLabelsToVerify: Set<string> | null }> {
  const responses: FunctionResponse[] = [];
  let bulkLabelsToVerify: Set<string> | null = null;

  for (const part of functionCalls) {
    const functionCall = (part as any).functionCall;
    const toolName: string = functionCall.name;
    const toolArgs: Record<string, any> = functionCall.args || {};

    const guardResponse = await evaluateToolGuards(toolName, toolArgs, ctx, jid, senderNumber, isGroup);
    if (guardResponse) {
      responses.push(guardResponse);
      continue;
    }

    const result = await dispatchTool(
      toolName,
      toolArgs,
      ctx,
      jid,
      senderNumber,
      isGroup,
      bulkLabelsToVerify,
    );

    responses.push(result.response);
    bulkLabelsToVerify = result.bulkLabelsToVerify;
  }

  return { responses, bulkLabelsToVerify };
}
