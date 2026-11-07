import { z } from 'zod';

export const GMAIL_DELIVERY_LIMITS = {
  recipients: 20, subject: 300, body: 200_000, attachments: 10,
  attachmentBytes: 10 * 1024 * 1024, totalAttachmentBytes: 20 * 1024 * 1024,
  rawMessageBytes: 30 * 1024 * 1024,
} as const;

const ADDRESS = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function hasUnsafeGmailHeader(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)
      || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) return true;
  }
  return false;
}

/** Una cadena representa exactamente un buzón; nunca una lista o grupo MIME. */
export function gmailRecipient(value: string): { name: string; address: string } | null {
  if (hasUnsafeGmailHeader(value) || value.length > 512) return null;
  const input = value.trim();
  if (ADDRESS.test(input) && input.length <= 254) return { name: '', address: input };
  const named = /^([^<>,;"@]+)\s*<([^<>]+)>$/.exec(input);
  if (!named || !named[1].trim() || named[1].trim().length > 200 || !ADDRESS.test(named[2]) || named[2].length > 254) return null;
  return { name: named[1].trim(), address: named[2] };
}

const recipient = z.string().max(512).refine(value => gmailRecipient(value) !== null);
const recipients = z.array(recipient).max(GMAIL_DELIVERY_LIMITS.recipients);
export const gmailSendSchema = z.object({
  to: recipients.min(1), cc: recipients.optional(), bcc: recipients.optional(),
  subject: z.string().min(1).max(GMAIL_DELIVERY_LIMITS.subject).refine(value => Boolean(value.trim()) && !hasUnsafeGmailHeader(value)),
  body: z.string().min(1).max(GMAIL_DELIVERY_LIMITS.body).refine(value => Boolean(value.trim())),
  isHtml: z.boolean().optional(),
  attachmentPaths: z.array(z.string().min(1).max(4096).refine(value => !hasUnsafeGmailHeader(value))).max(GMAIL_DELIVERY_LIMITS.attachments).optional(),
}).strict().refine(value => value.to.length + (value.cc?.length ?? 0) + (value.bcc?.length ?? 0) <= GMAIL_DELIVERY_LIMITS.recipients);

export type SendEmailParams = z.infer<typeof gmailSendSchema>;
export type GmailSendResult =
  | { success: true; messageId: string; error?: never; cancelled?: never; uncertain?: never }
  | { success: false; error: string; messageId?: never; cancelled?: boolean; uncertain?: boolean };
