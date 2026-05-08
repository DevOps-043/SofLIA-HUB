import { FLOW_ORCHESTRATOR_PROMPT, FLOW_RESPONSE_FALLBACK_PROMPT } from '../../prompts/flow';

export function buildFlowRequestParts(text: string, base64Image?: string): any[] {
  return buildRequestParts(`${FLOW_ORCHESTRATOR_PROMPT}\n\nSOLICITUD DEL USUARIO:\n${text}`, base64Image);
}

export function buildFlowFallbackRequestParts(text: string, base64Image?: string): any[] {
  return buildRequestParts(`${FLOW_RESPONSE_FALLBACK_PROMPT}\n\nSOLICITUD DEL USUARIO:\n${text}`, base64Image);
}

function buildRequestParts(text: string, base64Image?: string): any[] {
  const parts: any[] = [{ text }];
  if (base64Image) {
    parts.push({
      inlineData: {
        data: base64Image,
        mimeType: 'image/png',
      },
    });
  }
  return parts;
}
