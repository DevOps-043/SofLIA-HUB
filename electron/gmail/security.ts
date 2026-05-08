import { isValidEmail } from './helpers';
import type { SendEmailParams } from './types';

const HEADER_CONTROL_CHARS = /[\r\n\u0000-\u001F\u007F]/;
const MAX_SUBJECT_LENGTH = 300;
const MAX_BODY_LENGTH = 200_000;
const MAX_ATTACHMENTS = 10;

export function validateEmailRecipients(params: SendEmailParams): void {
  const validate = (emails: string[] | undefined, fieldName: string) => {
    if (!emails || !emails.length) return;
    for (const email of emails) {
      if (!isValidEmail(email)) {
        throw new Error(
          `Patron de correo anomalo detectado en el campo '${fieldName}': validacion de seguridad fallida para "${email}".`,
        );
      }
    }
  };

  validate(params.to, 'to');
  validate(params.cc, 'cc');
  validate(params.bcc, 'bcc');
}

export function validateEmailMessageSecurity(params: SendEmailParams): void {
  validateEmailRecipients(params);

  const subject = String(params.subject || '').trim();
  if (!subject) throw new Error('El asunto del correo es obligatorio.');
  if (subject.length > MAX_SUBJECT_LENGTH) throw new Error('El asunto del correo excede el limite permitido.');
  if (HEADER_CONTROL_CHARS.test(subject)) {
    throw new Error('Patron de correo anomalo detectado en el asunto: posible header injection.');
  }

  const body = String(params.body || '');
  if (!body.trim()) throw new Error('El cuerpo del correo es obligatorio.');
  if (body.length > MAX_BODY_LENGTH) throw new Error('El cuerpo del correo excede el limite permitido.');

  if ((params.attachmentPaths?.length || 0) > MAX_ATTACHMENTS) {
    throw new Error(`El correo excede el limite de ${MAX_ATTACHMENTS} adjuntos.`);
  }
}
