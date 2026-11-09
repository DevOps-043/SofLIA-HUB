import { boundedJsonSnapshot, isJsonStringChoice, type JsonObject, type JsonValue } from '../../src/shared/bounded-json';
import { jsonObject } from '../../src/shared/grounded-generation';
import { isSupportedMediaMimeType, MEDIA_BUDGET } from '../../src/shared/multimodal-input';
import { supportsCodeExecutionCombo } from '../../src/shared/gemini-grounding-config';
import { GEMINI_HISTORY_BYTES, GEMINI_MEDIA_RESOLUTIONS, GEMINI_SETUP_BYTES, type NativeGeminiRequest } from '../../src/shared/native-gemini-conversation';

const limits = { nodes: 60_000, depth: 20, array: 1000 };
export function conversationSnapshot(value: unknown, bytes: number): JsonValue {
  return boundedJsonSnapshot(value, bytes, limits);
}

function fail(): never { throw new Error('Solicitud de conversación no válida.'); }
function closed(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return jsonObject(value) && Object.keys(value).every(key => fields.includes(key));
}
function toolName(value: unknown): boolean {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value);
}
function validateTools(value: unknown, model: string): void {
  if (!Array.isArray(value) || value.length > 16) fail();
  for (const group of value) {
    if (closed(group, ['codeExecution']) && closed(group.codeExecution, []) && supportsCodeExecutionCombo(model)) continue;
    if (!closed(group, ['functionDeclarations']) || !Array.isArray(group.functionDeclarations) || group.functionDeclarations.length > 200) fail();
    for (const declaration of group.functionDeclarations) {
      if (!closed(declaration, ['name', 'description', 'parameters', 'parametersJsonSchema']) || !toolName(declaration.name)
        || (declaration.description !== undefined && typeof declaration.description !== 'string')
        || (declaration.parameters !== undefined && !jsonObject(declaration.parameters))
        || (declaration.parametersJsonSchema !== undefined && !jsonObject(declaration.parametersJsonSchema))) fail();
    }
  }
}
function validateConfig(config: unknown, model: string): void {
  if (!closed(config, ['systemInstruction', 'maxOutputTokens', 'temperature', 'thinkingConfig', 'mediaResolution', 'tools', 'toolConfig'])) fail();
  if (config.systemInstruction !== undefined && typeof config.systemInstruction !== 'string') fail();
  const max = config.maxOutputTokens;
  if (max !== undefined && (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > 16_384)) fail();
  const temperature = config.temperature;
  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) fail();
  const thinking = config.thinkingConfig;
  if (thinking !== undefined && (!closed(thinking, ['thinkingLevel'])
    || !isJsonStringChoice(thinking.thinkingLevel, ['low', 'medium', 'high', 'LOW', 'MEDIUM', 'HIGH']))) fail();
  if (config.mediaResolution !== undefined && !isJsonStringChoice(config.mediaResolution, GEMINI_MEDIA_RESOLUTIONS)) fail();
  if (config.tools !== undefined) validateTools(config.tools, model);
  if (config.toolConfig !== undefined && (!closed(config.toolConfig, ['includeServerSideToolInvocations'])
    || config.toolConfig.includeServerSideToolInvocations !== true)) fail();
}
function validateHistory(history: unknown): void {
  if (!Array.isArray(history) || history.length > 50 || history.length % 2 !== 0) fail();
  for (const [index, entry] of history.entries()) {
    if (!closed(entry, ['role', 'parts']) || entry.role !== (index % 2 === 0 ? 'user' : 'model')
      || !Array.isArray(entry.parts) || !entry.parts.length) fail();
    for (const part of entry.parts) if (!closed(part, ['text']) || typeof part.text !== 'string') fail();
  }
}
function validateUri(value: unknown): void {
  if (typeof value !== 'string' || value.length > 8192) fail();
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail();
}
function validatePart(part: unknown): void {
  if (closed(part, ['text']) && typeof part.text === 'string') return;
  if (closed(part, ['functionResponse']) && closed(part.functionResponse, ['name', 'response'])
    && toolName(part.functionResponse.name) && part.functionResponse.response !== undefined) return;
  if (closed(part, ['inlineData']) && closed(part.inlineData, ['mimeType', 'data'])) {
    const { mimeType, data } = part.inlineData;
    if (typeof mimeType === 'string' && isSupportedMediaMimeType(mimeType) && typeof data === 'string'
      && data.length > 0 && data.length <= Math.ceil(MEDIA_BUDGET.maxInlineBytes / 3) * 4
      && /^[A-Za-z0-9+/]+={0,2}$/.test(data)) return;
  }
  if (!closed(part, ['fileData', 'videoMetadata']) || !closed(part.fileData, ['mimeType', 'fileUri'])
    || typeof part.fileData.mimeType !== 'string' || !isSupportedMediaMimeType(part.fileData.mimeType)) fail();
  validateUri(part.fileData.fileUri);
  const video = part.videoMetadata;
  if (video === undefined) return;
  if (!closed(video, ['startOffset', 'endOffset', 'fps'])) fail();
  for (const offset of [video.startOffset, video.endOffset]) {
    if (offset !== undefined && (typeof offset !== 'string' || !/^\d{1,9}(?:\.\d{1,9})?s$/.test(offset))) fail();
  }
  if (video.fps !== undefined && (typeof video.fps !== 'number' || video.fps <= 0 || video.fps > 60)) fail();
}
export function validateConversationRequest(value: unknown): NativeGeminiRequest {
  const operation = value && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'operation')?.value : undefined;
  const request = conversationSnapshot(value, operation === 'send' ? GEMINI_HISTORY_BYTES : GEMINI_SETUP_BYTES);
  if (!jsonObject(request)) fail();
  if (request.operation === 'open') {
    if (!closed(request, ['operation', 'model', 'config', 'history']) || typeof request.model !== 'string') fail();
    const model = request.model.replace(/^models\//, '');
    if (!/^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(model)) fail();
    validateConfig(request.config, model);
    validateHistory(request.history);
    return { operation: 'open', model, config: request.config as JsonObject, history: request.history as JsonObject[] };
  }
  if (typeof request.turnId !== 'string' || !/^[a-f0-9-]{36}$/.test(request.turnId)) fail();
  if (request.operation === 'close' && closed(request, ['operation', 'turnId'])) return { operation: 'close', turnId: request.turnId };
  if (request.operation !== 'send' || !closed(request, ['operation', 'turnId', 'message', 'mediaResolution', 'disableTools'])) fail();
  if (typeof request.message !== 'string') {
    if (!Array.isArray(request.message) || !request.message.length || request.message.length > 100) fail();
    request.message.forEach(validatePart);
  }
  if (request.mediaResolution !== undefined && !isJsonStringChoice(request.mediaResolution, GEMINI_MEDIA_RESOLUTIONS)) fail();
  if (request.disableTools !== undefined && request.disableTools !== true) fail();
  return request as unknown as NativeGeminiRequest;
}
