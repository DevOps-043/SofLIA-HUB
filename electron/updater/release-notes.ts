import type { UpdateInfo } from 'electron-updater';

export function normalizeReleaseNotes(info: UpdateInfo): string | null {
  if (typeof info.releaseNotes === 'string') return info.releaseNotes;
  if (Array.isArray(info.releaseNotes)) {
    return info.releaseNotes.map((note) => typeof note === 'string' ? note : note.note).join('\n');
  }
  return null;
}
