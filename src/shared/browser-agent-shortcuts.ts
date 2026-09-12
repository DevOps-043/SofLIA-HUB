export const BROWSER_SHORTCUT_LIMITS = { count: 50, title: 80, instruction: 5000 } as const;
export interface BrowserAgentShortcut {
  id: string; title: string; instruction: string; scope: 'selected-tabs'; permission: 'read-fragments';
}
export interface BrowserShortcutLibrary { revision: number; entries: BrowserAgentShortcut[] }
export type BrowserShortcutRequest = ({ action: 'list' }
  | { action: 'save'; revision: number; entry: BrowserAgentShortcut }
  | { action: 'remove'; revision: number; id: string }) & { profileRevision: number };
export interface BrowserShortcutResponse { success: boolean; error?: string; library?: BrowserShortcutLibrary; canceled?: boolean }

function invalid(): never { throw new Error('Solicitud de atajos inválida.'); }
export function validateBrowserShortcut(raw: unknown, allowNew = false): BrowserAgentShortcut {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const entry = raw as BrowserAgentShortcut;
  if (Object.keys(entry).sort().join(',') !== 'id,instruction,permission,scope,title'
    || typeof entry.id !== 'string' || !(allowNew && entry.id === '') && !/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(entry.id)
    || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > BROWSER_SHORTCUT_LIMITS.title
    || typeof entry.instruction !== 'string' || !entry.instruction.trim() || entry.instruction.length > BROWSER_SHORTCUT_LIMITS.instruction
    || entry.scope !== 'selected-tabs' || entry.permission !== 'read-fragments') return invalid();
  return { ...entry, title: entry.title.trim(), instruction: entry.instruction.trim() };
}
export function validateBrowserShortcutRequest(raw: unknown): BrowserShortcutRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const input = raw as BrowserShortcutRequest;
  if (!Number.isSafeInteger(input.profileRevision) || input.profileRevision < 0) return invalid();
  const keys = Object.keys(input).sort().join(',');
  if (input.action === 'list' && keys === 'action,profileRevision') return { action: 'list', profileRevision: input.profileRevision };
  if (input.action !== 'save' && input.action !== 'remove') return invalid();
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) return invalid();
  if (input.action === 'save' && keys === 'action,entry,profileRevision,revision') return { ...input, entry: validateBrowserShortcut(input.entry, true) };
  if (input.action === 'remove' && keys === 'action,id,profileRevision,revision' && typeof input.id === 'string' && /^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(input.id)) return { ...input };
  return invalid();
}
