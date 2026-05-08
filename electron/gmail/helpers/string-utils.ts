import { ANGLE_EMAIL_REGEX, PLAIN_EMAIL_REGEX } from './email-patterns';

export function extractEmailAddress(rawValue: string): string {
  const angleMatch = rawValue.match(ANGLE_EMAIL_REGEX);
  if (angleMatch?.[1]) {
    return angleMatch[1].trim().toLowerCase();
  }

  const directMatch = rawValue.match(PLAIN_EMAIL_REGEX);
  return directMatch?.[0]?.trim().toLowerCase() || '';
}

export function cleanSenderDisplayName(rawValue: string, email: string): string {
  const withoutEmail = rawValue.replace(/<[^>]+>/g, '');
  const withoutQuotes = withoutEmail.replace(/^["'\s]+|["'\s]+$/g, '');
  const cleaned = withoutQuotes
    .replace(/\((via|mediante)[^)]+\)/gi, '')
    .replace(/\b(via|mediante)\s+.+$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) return cleaned;
  return email.split('@')[0] || rawValue.trim();
}

export function normalizeGroupingKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toTitleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function sanitizeLabelName(value: string): string {
  const trimmed = value
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return trimmed.slice(0, 225) || 'Otros';
}
