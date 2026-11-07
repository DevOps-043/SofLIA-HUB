import { observeToolResult, type ToolObservation } from '../../whatsapp/tool-observation';

export type ToolResultEnvelope = { functionResponse: { name: string; response: unknown } };
export function summarizeFunctionResponses(results: ToolResultEnvelope[]): ToolObservation[] {
  return results.map(({ functionResponse }) => observeToolResult(functionResponse.name, functionResponse.response));
}
