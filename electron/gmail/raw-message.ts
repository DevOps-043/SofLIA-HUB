import MailComposer from 'nodemailer/lib/mail-composer';
import { GMAIL_DELIVERY_LIMITS, gmailRecipient } from '../../src/shared/gmail-delivery';
import type { SendEmailParams } from './types';
import { prepareGmailAttachments } from './attachments';

/** El compositor sólo recibe bytes preparados: no puede abrir rutas ni URLs. */
export async function buildRawMessage(params: SendEmailParams, assertCurrent: () => void = () => {}) {
  const attachments = await prepareGmailAttachments(params.attachmentPaths ?? [], assertCurrent);
  assertCurrent();
  const addresses = (values: string[] = []) => values.map(value => {
    const parsed = gmailRecipient(value);
    if (!parsed) throw new Error('invalid_recipient');
    return parsed;
  });
  const message = new MailComposer({
    to: addresses(params.to), cc: addresses(params.cc), bcc: addresses(params.bcc),
    subject: params.subject, ...(params.isHtml ? { html: params.body } : { text: params.body }),
    attachments: attachments.map(file => ({ filename: file.filename, content: file.content, contentDisposition: 'attachment' })),
    disableFileAccess: true, disableUrlAccess: true, newline: '\r\n',
  }).compile();
  // Gmail obtiene el sobre del raw: BCC debe viajar al proveedor, que lo retira.
  message.keepBcc = true;
  const raw = await message.build();
  assertCurrent();
  if (raw.length > GMAIL_DELIVERY_LIMITS.rawMessageBytes) throw new Error('message_too_large');
  return { raw, attachments: attachments.map(file => ({ filename: file.filename, path: file.path, bytes: file.content.length })) };
}
