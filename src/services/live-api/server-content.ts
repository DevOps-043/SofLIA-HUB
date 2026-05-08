import { sendLivePayload, type LiveRuntime } from './runtime';

export async function processServerContent(runtime: LiveRuntime, content: any): Promise<void> {
  if (runtime.isDisposed || !content.modelTurn?.parts) return;
  console.log('Live API: Received server content parts:', content.modelTurn.parts.length);

  for (const part of content.modelTurn.parts) {
    if (part.text) {
      console.log('Live API: Text response received:', part.text.substring(0, 50) + '...');
      runtime.callbacks.onTextResponse(part.text);
    }
    if (part.inlineData?.data) {
      runtime.callbacks.onAudioResponse(part.inlineData.data);
      runtime.audio.playBase64(part.inlineData.data, runtime.isDisposed);
    }
    if (part.functionCall) {
      console.log('Live API: Tool call received:', part.functionCall.name);
      await handleFunctionCall(runtime, part.functionCall);
    }
  }

  if (content.modelTurn?.groundingMetadata) {
    console.log('Live API: Grounding metadata received');
    runtime.callbacks.onGroundingMetadata?.(content.modelTurn.groundingMetadata);
  }
}

async function handleFunctionCall(runtime: LiveRuntime, functionCall: { name: string; args: any }): Promise<void> {
  if (runtime.isDisposed || !runtime.callbacks.onFunctionCall) return;
  try {
    const result = await runtime.callbacks.onFunctionCall(functionCall);
    sendToolResponse(runtime, functionCall.name, { result });
  } catch (error: any) {
    sendToolResponse(runtime, functionCall.name, { error: error.message || 'Failed' });
  }
}

function sendToolResponse(runtime: LiveRuntime, name: string, response: Record<string, any>): void {
  sendLivePayload(runtime, {
    toolResponse: {
      functionResponses: [{ name, response }],
    },
  });
}
