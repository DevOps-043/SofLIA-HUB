import type { WorkflowActionKind } from '../types';

const ALLOWED_CAPABILITIES: WorkflowActionKind[] = [
  'desktop_task',
  'gchat_message',
  'gmail_reply',
  'gmail_send',
  'calendar_event',
  'gmail_labels',
  'drive_folder_tree',
];

export function sanitizeCapabilities(value: unknown): WorkflowActionKind[] {
  const incoming = Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const normalized = incoming.filter((item): item is WorkflowActionKind =>
    ALLOWED_CAPABILITIES.includes(item as WorkflowActionKind),
  );
  return normalized.length > 0 ? normalized : ['desktop_task'];
}
