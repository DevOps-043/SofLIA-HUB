import { z } from 'zod';

export const REMOTE_NODE_IPC_MAX_BYTES = 128 * 1024;
const text = (max: number) => z.string().min(1).max(max).refine(value => value.trim().length > 0 && !Array.from(value).some(character => {
  const code = character.charCodeAt(0);
  return code === 127 || code < 32 && ![9, 10, 13].includes(code);
}));
const singleLine = (max: number) => text(max).refine(value => !/[\r\n\t]/.test(value));
export const remoteNodeId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,47}$/);
export const remoteNodeBindAddress = z.union([z.ipv4(), z.ipv6(), z.hostname().max(253)]);
export const remoteNodeSessionId = singleLine(256);
const sessionId = remoteNodeSessionId;
export const remoteNodeBaseUrl = singleLine(4096).refine(value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash; }
  catch { return false; }
});
const httpUrl = remoteNodeBaseUrl;
export const remoteHostUpdates = z.object({
  enabled: z.boolean().optional(), bind_address: remoteNodeBindAddress.optional(),
  port: z.number().int().min(1).max(65535).optional(), node_name: singleLine(160).optional(),
  advertise_url: httpUrl.nullable().optional(), rotate_token: z.boolean().optional(),
}).strict().refine(value => Object.values(value).some(field => field !== undefined));
export const remoteNodeRegistration = z.object({
  id: remoteNodeId.optional(), name: singleLine(160), base_url: httpUrl, token: singleLine(4096),
  enabled: z.boolean().optional(), owner_user_id: singleLine(128).nullable().optional(),
  organization_id: singleLine(128).nullable().optional(), visibility: z.enum(['personal', 'organization']).optional(),
}).strict();
export const remoteOpenApplication = z.object({ path: text(4096) }).strict();
export const remoteBackgroundCommand = z.object({ command: text(20000), working_directory: text(4096).optional(), title: singleLine(160).optional() }).strict();
export const remoteDesktopTask = z.object({
  task: text(20000), max_steps: z.number().int().min(1).max(1000).optional(),
  backend: z.enum(['auto', 'browser', 'desktop', 'uia']).optional(), start_url: httpUrl.optional(),
  browser_profile: singleLine(128).optional(), browser_isolated: z.boolean().optional(), reset_browser_profile: z.boolean().optional(),
}).strict();
export const remoteScreenshot = z.object({ display_id: singleLine(128).optional() }).strict();
export type RemoteOpenApplicationInput = z.infer<typeof remoteOpenApplication>;
export type RemoteBackgroundCommandInput = z.infer<typeof remoteBackgroundCommand>;
export type RemoteDesktopTaskInput = z.infer<typeof remoteDesktopTask>;
export type RemoteScreenshotInput = z.infer<typeof remoteScreenshot>;
export const remoteNodeInputs = {
  'get-host-status': z.tuple([]), 'update-host-config': z.tuple([remoteHostUpdates]),
  'list-nodes': z.tuple([]), 'register-node': z.tuple([remoteNodeRegistration]),
  'remove-node': z.tuple([remoteNodeId]), 'test-node': z.tuple([remoteNodeId]),
  'open-application': z.tuple([remoteNodeId, remoteOpenApplication]),
  'run-background-command': z.tuple([remoteNodeId, remoteBackgroundCommand]),
  'execute-task': z.tuple([remoteNodeId, remoteDesktopTask]),
  'take-screenshot': z.tuple([remoteNodeId, remoteScreenshot.optional()]),
  'list-process-sessions': z.tuple([remoteNodeId]),
  'poll-process-session': z.tuple([remoteNodeId, sessionId]),
  'kill-process-session': z.tuple([remoteNodeId, sessionId]),
};

/** Entradas IPC planas: rechazar getters, prototipos y volumen antes de parsear. */
export function remoteNodeSnapshot(args: unknown[]): unknown[] {
  if (args.length > 2) throw new Error('invalid_payload');
  const scalar = (value: unknown) => {
    if (typeof value === 'string' && value.length > 20000) throw new Error('invalid_payload');
    if (value !== null && !['string', 'number', 'boolean', 'undefined'].includes(typeof value)) throw new Error('invalid_payload');
    return value;
  };
  const snapshot = args.map(value => {
    if (!value || typeof value !== 'object') return scalar(value);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error('invalid_payload');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length > 16) throw new Error('invalid_payload');
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('invalid_payload');
      const descriptor = descriptors[key];
      if (!('value' in descriptor)) throw new Error('invalid_payload');
      output[key] = scalar(descriptor.value);
    }
    return output;
  });
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > REMOTE_NODE_IPC_MAX_BYTES) throw new Error('invalid_payload');
  return snapshot;
}
