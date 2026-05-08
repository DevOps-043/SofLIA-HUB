import crypto from 'node:crypto';

export function normalizeMeetingText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hashMeetingText(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export function extractDriveFileId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParamMatch?.[1]) {
    return idParamMatch[1];
  }

  const pathMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
