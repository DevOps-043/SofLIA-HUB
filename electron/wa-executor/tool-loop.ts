import { dispatchTool } from './tool-dispatch';
import { evaluateToolGuards } from './tool-guards';
import type { FunctionResponse, ToolExecutorContext } from './types';
import { unexpectedToolFailure } from './unexpected-failure';

export async function executeWhatsAppTools(
  functionCalls: any[],
  ctx: ToolExecutorContext,
  jid: string,
  senderNumber: string,
  isGroup: boolean,
): Promise<{ responses: FunctionResponse[] }> {
  const responses: FunctionResponse[] = [];

  for (const part of functionCalls) {
    const functionCall = (part as any).functionCall;
    const toolName: string = functionCall.name;
    const toolArgs: Record<string, any> = functionCall.args || {};

    let guardResponse: FunctionResponse | null;
    try { guardResponse = await evaluateToolGuards(toolName, toolArgs, ctx, jid, senderNumber, isGroup); }
    catch { responses.push(unexpectedToolFailure(toolName, 'guard')); continue; }
    if (guardResponse) {
      responses.push(guardResponse);
      continue;
    }

    // El fallo de UNA herramienta es un resultado del turno, no el final del
    // turno: se le devuelve al modelo como respuesta fallida para que lo
    // explique o intente otra via. Sin esto, cualquier handler que lanzara
    // (solo el fallback capturaba) tumbaba la conversacion entera y el usuario
    // recibia un error tecnico generico en vez de una respuesta.
    let result: Awaited<ReturnType<typeof dispatchTool>>;
    try {
      result = await dispatchTool(
        toolName,
        toolArgs,
        ctx,
        jid,
        senderNumber,
        isGroup,
      );
    } catch {
      responses.push(unexpectedToolFailure(toolName, 'execution'));
      continue;
    }

    responses.push(result.response);
  }

  return { responses };
}
