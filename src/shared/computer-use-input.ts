import { z } from 'zod';
import { documentDesignSchema } from './document-design';

export const COMPUTER_IPC_MAX_BYTES = 12 * 1024 * 1024;
const hasControl = (value: string) => Array.from(value).some(character => { const code = character.charCodeAt(0); return code < 32 || code === 127; });
const path = z.string().max(4096).refine(value => !hasControl(value));
const requiredPath = path.refine(value => value.trim().length > 0);
const command = z.string().min(1).max(20000).refine(value => value.trim().length > 0 && !value.includes('\0'));
const text = z.string().max(4 * 1024 * 1024);
const session = z.string().min(1).max(256).refine(value => !hasControl(value));
const coordinate = z.tuple([z.number().finite().int().min(-100000).max(100000), z.number().finite().int().min(-100000).max(100000)]);
export const computerGuiInput = z.object({
  action: z.enum(['screenshot', 'mouse_move', 'left_click', 'left_click_drag', 'right_click', 'middle_click', 'double_click', 'type', 'key']).optional(),
  coordinate: coordinate.optional(), text: z.string().max(20000).optional(), display_id: session.optional(),
}).strict().refine(value => {
  const action = value.action ?? 'screenshot';
  if (['type', 'key'].includes(action)) return Boolean(value.text);
  return action === 'screenshot' || Boolean(value.coordinate || value.text);
});
export const computerWordInput = z.object({
  title: z.string().max(1000).optional(), subtitle: z.string().max(2000).optional(),
  author: z.string().max(1000).optional(), content: z.string().min(1).max(250000),
  file_name: path.optional(), output_path: path.optional(), include_cover: z.boolean().optional(),
  design: documentDesignSchema.optional(), open_after_save: z.boolean().optional(),
  chart_images: z.array(z.string().max(2 * 1024 * 1024)).max(12).optional(),
}).strict();
const organize = z.object({
  path: path.optional(), mode: z.enum(['extension', 'type', 'date', 'custom']).optional(),
  dry_run: z.boolean().optional(), recursive: z.boolean().optional(),
  rules: z.record(z.string().min(1).max(80), requiredPath).refine(value => JSON.stringify(value).length <= 20000).optional(),
}).strict();
const batch = z.object({
  source_directory: requiredPath, destination_directory: requiredPath,
  pattern: z.string().max(1000).optional(), extensions: z.array(z.string().max(80)).max(128).optional(),
  recursive: z.boolean().optional(), group_by_extension: z.boolean().optional(),
}).strict();
const background = z.object({ command, working_directory: requiredPath.optional(), title: z.string().max(160).optional() }).strict();

export const computerInputs = {
  'list-screens': z.tuple([]), 'list-processes': z.tuple([]),
  'kill-process': z.tuple([z.number().int().positive().max(2147483647)]),
  'list-directory': z.tuple([path, z.boolean().optional()]), 'read-file': z.tuple([requiredPath]),
  'write-file': z.tuple([requiredPath, text]), 'create-word-document': z.tuple([computerWordInput]),
  'create-directory': z.tuple([requiredPath]), 'move-item': z.tuple([requiredPath, requiredPath]),
  'copy-item': z.tuple([requiredPath, requiredPath]), 'delete-item': z.tuple([requiredPath]),
  'get-file-info': z.tuple([requiredPath]), 'search-files': z.tuple([path, z.string().min(1).max(1000)]),
  'organize-files': z.tuple([organize]), 'batch-move-files': z.tuple([batch]),
  'list-directory-summary': z.tuple([z.object({ path: path.optional(), recursive: z.boolean().optional(), max_depth: z.number().int().min(1).max(12).optional() }).strict()]),
  'undo-last-file-operation': z.tuple([z.object({ operation_id: session.optional() }).strict().optional()]),
  'execute-command': z.tuple([command]), 'open-application': z.tuple([requiredPath]),
  'open-file-on-computer': z.tuple([requiredPath]),
  'open-url': z.tuple([z.string().max(8192).refine(value => {
    try { const url = new URL(/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) ? value : `https://${value}`); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  })]),
  'run-background-command': z.tuple([background]), 'list-process-sessions': z.tuple([]),
  'poll-process-session': z.tuple([session]), 'kill-process-session': z.tuple([session]),
  'get-system-info': z.tuple([]), 'clipboard-read': z.tuple([]), 'clipboard-write': z.tuple([text]),
  'use-computer': z.tuple([computerGuiInput]), 'take-screenshot': z.tuple([session.optional()]),
  'get-email-config': z.tuple([]),
  'configure-email': z.tuple([z.email().max(320), z.string().min(1).max(4096)]),
  'send-email': z.tuple([z.string().min(1).max(4096).refine(value => !/[\r\n\0]/.test(value)), z.string().max(1000).refine(value => !/[\r\n\0]/.test(value)), z.string().max(1000000), z.array(requiredPath).max(10).refine(value => JSON.stringify(value).length <= 20000).optional(), z.boolean().optional()]),
  'confirm-action': z.tuple([z.string().min(1).max(8000), z.object({ allowAlways: z.boolean().optional(), command: z.string().max(4000).optional() }).strict().optional()]),
};

/** Copia acotada antes de schemas: nunca invoca getters ni serializadores del emisor. */
export function computerInputSnapshot(input: unknown[]): unknown[] {
  let nodes = 0, bytes = 0;
  const visit = (value: unknown, depth: number): unknown => {
    if (++nodes > 20000 || depth > 8) throw new Error('invalid_payload');
    if (value === undefined || value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      if (value.length > COMPUTER_IPC_MAX_BYTES) throw new Error('invalid_payload');
      bytes += new TextEncoder().encode(value).byteLength;
      if (bytes > COMPUTER_IPC_MAX_BYTES) throw new Error('invalid_payload');
      return value;
    }
    if (!value || typeof value !== 'object') throw new Error('invalid_payload');
    if (Array.isArray(value)) {
      if (value.length > 256) throw new Error('invalid_payload');
      const output: unknown[] = [];
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor)) throw new Error('invalid_payload');
        output.push(visit(descriptor.value, depth + 1));
      }
      return output;
    }
    if (![null, Object.prototype].includes(Object.getPrototypeOf(value))) throw new Error('invalid_payload');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length > 128) throw new Error('invalid_payload');
    const output: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) || key.length > 4096) throw new Error('invalid_payload');
      bytes += new TextEncoder().encode(key).byteLength;
      if (bytes > COMPUTER_IPC_MAX_BYTES) throw new Error('invalid_payload');
      const descriptor = descriptors[key]; if (!('value' in descriptor)) throw new Error('invalid_payload');
      output[key] = visit(descriptor.value, depth + 1);
    }
    return output;
  };
  if (input.length > 5) throw new Error('invalid_payload');
  const snapshot = visit(input, 0) as unknown[];
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > COMPUTER_IPC_MAX_BYTES) throw new Error('invalid_payload');
  return snapshot;
}
