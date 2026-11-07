import { GoogleGenAI, type Content, type GenerateContentConfig, type Part } from '@google/genai';
import { buildServerSideToolInvocationsConfig, GEMINI_GROUNDING_API } from '../../src/shared/gemini-grounding-config';
import type { NativeGeminiSend, NativeGeminiSetup } from '../../src/shared/native-gemini-conversation';

export interface GeminiProviderResult { response: unknown; history: unknown }
export type GeminiConversationProvider = (
  key: string, setup: NativeGeminiSetup, request: NativeGeminiSend, signal: AbortSignal,
) => Promise<GeminiProviderResult>;

const GEMINI_ORIGIN = new URL(GEMINI_GROUNDING_API.generateContentBaseUrl).origin;

export const generateGeminiConversation: GeminiConversationProvider = async (key, setup, request, signal) => {
  const ai = new GoogleGenAI({
    apiKey: key,
    vertexai: false,
    apiVersion: 'v1beta',
    httpOptions: { baseUrl: GEMINI_ORIGIN },
  });
  const config = { ...setup.config, abortSignal: signal } as GenerateContentConfig;
  if (request.mediaResolution) config.mediaResolution = request.mediaResolution as GenerateContentConfig['mediaResolution'];
  if (request.disableTools) config.tools = [];
  config.toolConfig = buildServerSideToolInvocationsConfig(config.tools);
  const chat = ai.chats.create({ model: setup.model, history: setup.history as unknown as Content[], config });
  const result = await chat.sendMessage({ message: request.message as string | Part[], config });
  return {
    response: { text: result.text, candidates: result.candidates, promptFeedback: result.promptFeedback },
    history: chat.getHistory(true),
  };
};
