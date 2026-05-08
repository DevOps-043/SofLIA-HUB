import type { EmailMessage } from '../../gmail-service';

export function pickBestMessage(messages: EmailMessage[]): EmailMessage {
  const unread = messages.find((message) => message.isUnread);
  return unread || messages[0];
}

export function extractPrimaryEmailAddress(fromHeader: string): string | null {
  const angleMatch = String(fromHeader || '').match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  const directMatch = String(fromHeader || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return directMatch?.[0]?.trim() || null;
}

export function buildReplySubject(subject: string): string {
  const trimmed = String(subject || '').trim();
  if (!trimmed) return 'Seguimiento';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}
