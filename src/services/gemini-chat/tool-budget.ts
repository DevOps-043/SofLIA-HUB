import type { ToolCallInfo } from './types';

/** Mensaje honesto cuando el modelo no cerró el turno dentro del presupuesto. */
export function toolBudgetExhaustedMessage(toolCalls: ToolCallInfo[]): string {
  const last = toolCalls[toolCalls.length - 1];
  const detail = last ? describeLastTool(last) : 'No quedó una herramienta final verificable.';
  return `No pude completar la respuesta dentro del presupuesto de herramientas. ${detail} No asumiré que la tarea terminó. Vuelve a intentarlo o acota la solicitud.`;
}

function describeLastTool(toolCall: ToolCallInfo): string {
  const name = toolCall.name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'desconocida';
  try {
    const result = JSON.parse(toolCall.result || '{}') as { success?: unknown; error?: unknown };
    if (result.success === false && typeof result.error === 'string') {
      return `La última herramienta (${name}) falló: ${result.error.slice(0, 200)}.`;
    }
  } catch {
    // Un resultado no estructurado no se presenta como éxito ni como error.
  }
  return `La última herramienta fue ${name}, pero no produjo una respuesta final verificable.`;
}
