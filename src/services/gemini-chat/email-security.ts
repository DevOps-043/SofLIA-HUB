const STRICT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const HEADER_CONTROL_CHARS = /[\r\n\u0000-\u001F\u007F]/;
const MAX_SUBJECT_LENGTH = 300;
const MAX_BODY_LENGTH = 200_000;
const MAX_RECIPIENTS = 20;

function parseRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateRecipients(value: unknown, fieldName: string): string[] {
  const recipients = parseRecipients(value);
  if (recipients.length === 0) {
    throw new Error(`El campo ${fieldName} debe incluir al menos un correo valido.`);
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw new Error(`El campo ${fieldName} excede el limite de ${MAX_RECIPIENTS} destinatarios.`);
  }

  for (const email of recipients) {
    if (!STRICT_EMAIL_REGEX.test(email) || HEADER_CONTROL_CHARS.test(email)) {
      throw new Error(`Correo invalido o inseguro en ${fieldName}: ${email}`);
    }
  }
  return recipients;
}

function validateHeader(value: unknown, fieldName: string): string {
  const text = String(value || '').trim();
  if (!text) throw new Error(`El campo ${fieldName} es obligatorio.`);
  if (text.length > MAX_SUBJECT_LENGTH) throw new Error(`El campo ${fieldName} es demasiado largo.`);
  if (HEADER_CONTROL_CHARS.test(text)) throw new Error(`El campo ${fieldName} contiene caracteres de control.`);
  return text;
}

export function buildSafeGmailSendParams(args: Record<string, any>) {
  const body = String(args.body || '');
  if (!body.trim()) throw new Error('El cuerpo del correo es obligatorio.');
  if (body.length > MAX_BODY_LENGTH) throw new Error('El cuerpo del correo excede el limite permitido.');

  return {
    to: validateRecipients(args.to, 'to'),
    subject: validateHeader(args.subject, 'subject'),
    body,
    isHtml: args.is_html === true,
    attachmentPaths: Array.isArray(args.attachment_paths)
      ? args.attachment_paths.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10)
      : undefined,
  };
}
