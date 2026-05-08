import { MODELS } from '../../config';
import { buildPrimaryChatPrompt } from '../../prompts/chat';
import { isComputerUseAvailable } from '../computer-use-service';
import { runAgenticLoop } from './agentic-loop';
import { getGenAI } from './client';
import { buildGeminiHistory } from './history';
import { buildMessageContent } from './message-content';
import { buildGenerationConfig, buildModelTools, resolveModelId } from './model-config';
import { buildStreamingResult } from './streams';
import { buildSystemInstruction } from './system-instruction';
import type { ConversationMessage, SendMessageStreamOptions, StreamResult, ToolCallInfo } from './types';

export async function sendMessageStream(
  message: string,
  conversationHistory: ConversationMessage[] = [],
  options?: SendMessageStreamOptions,
): Promise<StreamResult> {
  const ai = await getGenAI();
  const computerUseEnabled = isComputerUseAvailable();
  const model = ai.getGenerativeModel({
    model: resolveModelId(options),
    systemInstruction: buildSystemInstruction(message, options),
    tools: buildModelTools(computerUseEnabled),
  });

  const finalMessage = options?.context ? buildPrimaryChatPrompt(options.context, message) : message;
  const chatSession = model.startChat({
    history: buildGeminiHistory(conversationHistory),
    generationConfig: buildGenerationConfig(options),
  });
  const messageContent = buildMessageContent(finalMessage, options?.images);
  const allToolCalls: ToolCallInfo[] = [];
  const allGeneratedImages: string[] = [];

  if (computerUseEnabled || hasAlwaysEnabledProjectHubTools()) {
    return runAgenticLoop({ chatSession, messageContent, options, allToolCalls, allGeneratedImages });
  }

  return buildStreamingResult(await chatSession.sendMessageStream(messageContent), allGeneratedImages);
}

function hasAlwaysEnabledProjectHubTools(): boolean {
  return !!MODELS.PRIMARY;
}
