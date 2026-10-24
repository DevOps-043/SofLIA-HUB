import path from 'node:path';
import { z } from 'zod';
import type { PythonRuntimeStatus, VoicePassiveConfig } from '../python-runtime-service';
import type { VoicePassiveStatus } from '../../src/shared/local-voice';

function allowedText(value: string, max: number, whitespace = false): boolean {
  if (!value.length || value.length > max || !value.trim()) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if ((code < 32 && !(whitespace && [9, 10, 13].includes(code))) || code === 127) return false;
  }
  return true;
}
const text = (max: number) => z.string().min(1).max(max).refine(value => allowedText(value, max));
export const micDeviceSchema = z.union([z.null(), z.number().int().min(0).max(65535), text(512)]);
export const modelSizeSchema = z.enum(['small', 'large']).optional().default('small');
export const piperVoiceSchema = z.enum(['es_MX-claude-high', 'es_MX-ald-medium', 'es_ES-davefx-medium', 'es_ES-sharvard-medium']);
export const speechTextSchema = z.string().min(1).max(5000).refine(value => allowedText(value, 5000, true) && Boolean(value.trim()));
export const voiceIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9-]+$/u).nullish();
const configSchema = z.object({ enabled: z.boolean().optional(), wakeWords: z.array(text(64)).min(1).max(10).optional(),
  modelPath: text(4096).refine(value => path.isAbsolute(value) && !value.startsWith('\\\\') && !value.startsWith('//')).optional(),
  micDevice: micDeviceSchema.optional(), ttsVoice: text(128).optional(), ttsSpeed: z.number().min(0.5).max(2).optional(),
}).strict();

/** Copia plana y acotada antes de cualquier revisión asíncrona. */
export function parseVoiceConfig(value: unknown): Partial<VoicePassiveConfig> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('voice_invalid_input');
  const keys = Reflect.ownKeys(value);
  if (!keys.length || keys.length > 6 || keys.some(key => typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(configSchema.shape, key))) throw new Error('voice_invalid_input');
  const copy: Record<string, unknown> = {};
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.value === undefined) throw new Error('voice_invalid_input');
    copy[key] = descriptor.value;
  }
  if (Array.isArray(copy.wakeWords) && copy.wakeWords.length > 10) throw new Error('voice_invalid_input');
  return configSchema.parse(copy);
}
export function publicVoiceConfig(config: VoicePassiveConfig) {
  return { enabled: config.enabled, wakeWords: [...config.wakeWords], micDevice: config.micDevice ?? null, ttsVoice: config.ttsVoice, ttsSpeed: config.ttsSpeed };
}
export function publicVoiceStatus(status: PythonRuntimeStatus, approved: boolean): VoicePassiveStatus {
  return { runtimeAvailable: status.runtimeAvailable, sidecarRunning: status.sidecarRunning, listening: status.listening,
    enabled: status.enabled, modelInstalled: Boolean(status.modelPath), approvalRequired: !approved,
    largeModelInstalled: status.largeModelInstalled, modelDownloadProgress: status.modelDownloadProgress, ttsReady: status.ttsReady,
    ttsDownloadProgress: status.ttsDownloadProgress, dictating: status.dictating,
    lastError: status.lastError ? 'La voz local no está disponible. Revisa el runtime, el modelo y la autorización de esta sesión.' : null };
}
export function captureSignature(config: VoicePassiveConfig): string {
  return JSON.stringify([config.micDevice ?? null, config.modelPath ?? null, config.wakeWords]);
}
