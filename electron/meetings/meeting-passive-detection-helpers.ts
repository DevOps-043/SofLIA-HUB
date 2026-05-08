import type { DriveFile } from '../drive-service';

export function hasGoogleMeetSignal(item: any): boolean {
  const text = `${item.location || ''} ${item.description || ''} ${item.hangoutLink || ''}`.toLowerCase();
  return Boolean(item.hangoutLink || item.conferenceData || text.includes('meet.google.com'));
}

export function looksLikeMeetingRecordSubject(subject: string): boolean {
  return /registros de reuniones|meeting records|transcript/i.test(subject || '');
}

export function extractMeetingTitleFromEmail(subject: string): string | null {
  return subject
    .replace(/registros de reuniones\s*:/i, '')
    .replace(/meeting records\s*:/i, '')
    .trim() || null;
}

export function inferMeetingTitleFromFile(file: DriveFile): string | null {
  return file.name
    .replace(/\s*-\s*transcript$/i, '')
    .replace(/\s*-\s*transcripcion$/i, '')
    .trim() || null;
}

export function matchTranscriptFile(files: DriveFile[], meetingCode: string | null, meetingTitle: string | null): DriveFile | null {
  const normalizedTitle = normalizeText(meetingTitle);
  const normalizedCode = meetingCode?.toLowerCase() || null;
  for (const file of files) {
    const normalizedFileName = normalizeText(file.name);
    if (normalizedCode && normalizedFileName.includes(normalizedCode)) return file;
    if (normalizedTitle && normalizedTitle.length >= 8 && normalizedFileName.includes(normalizedTitle)) return file;
  }
  return null;
}

export function extractMeetingCode(value: string): string | null {
  const match = value.match(/\b[a-z]{3}-[a-z]{4}-[a-z]{3}\b/i);
  return match?.[0]?.toLowerCase() || null;
}

export function extractDriveFileId(value: string): string | null {
  if (!value) return null;
  const pathMatch = value.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch?.[1]) return pathMatch[1];
  const idParamMatch = value.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return idParamMatch?.[1] || null;
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
