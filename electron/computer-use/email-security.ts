const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const HEADER_CONTROL_CHARS = /[\r\n\u0000-\u001F\u007F]/;
const MAX_RECIPIENTS = 20;
const MAX_SUBJECT_LENGTH = 300;
const MAX_BODY_LENGTH = 200_000;
const MAX_ATTACHMENTS = 10;

const SMTP_PROVIDERS: Record<string, { host: string; port: number }> = {
  'gmail.com': { host: 'smtp.gmail.com', port: 587 },
  'googlemail.com': { host: 'smtp.gmail.com', port: 587 },
  'outlook.com': { host: 'smtp.office365.com', port: 587 },
  'hotmail.com': { host: 'smtp.office365.com', port: 587 },
  'live.com': { host: 'smtp.office365.com', port: 587 },
  'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 587 },
  'yahoo.com.mx': { host: 'smtp.mail.yahoo.com', port: 587 },
  'icloud.com': { host: 'smtp.mail.me.com', port: 587 },
  'me.com': { host: 'smtp.mail.me.com', port: 587 },
  'protonmail.com': { host: 'smtp.protonmail.ch', port: 587 },
  'zoho.com': { host: 'smtp.zoho.com', port: 587 },
};

function assertSafeHeader(value: string, fieldName: string): void {
  if (!value.trim()) throw new Error(`${fieldName} es obligatorio.`);
  if (value.length > MAX_SUBJECT_LENGTH) throw new Error(`${fieldName} excede el limite permitido.`);
  if (HEADER_CONTROL_CHARS.test(value)) throw new Error(`${fieldName} contiene caracteres de control.`);
}

export function detectSmtp(email: string): { host: string; port: number } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? SMTP_PROVIDERS[domain] || null : null;
}

export function validateEmailAddress(email: string): string {
  const normalized = String(email || '').trim();
  if (!EMAIL_REGEX.test(normalized) || HEADER_CONTROL_CHARS.test(normalized)) {
    throw new Error(`Correo invalido o inseguro: ${email}`);
  }
  return normalized;
}

export function validateEmailConfigInput(args: Record<string, any>): { email: string; password: string } {
  const email = validateEmailAddress(args.email);
  const password = String(args.password || '');
  if (password.length < 8) throw new Error('La contrasena de aplicacion debe tener al menos 8 caracteres.');
  if (HEADER_CONTROL_CHARS.test(password)) throw new Error('La contrasena contiene caracteres de control.');
  return { email, password };
}

export function validateOutgoingEmailArgs(args: Record<string, any>) {
  const rawRecipients = Array.isArray(args.to) ? args.to : String(args.to || '').split(',');
  const to = rawRecipients.map((item: string) => validateEmailAddress(item)).filter(Boolean);
  if (to.length === 0) throw new Error('Debe proporcionar al menos un destinatario valido.');
  if (to.length > MAX_RECIPIENTS) throw new Error(`El correo excede el limite de ${MAX_RECIPIENTS} destinatarios.`);

  const subject = String(args.subject || '').trim();
  assertSafeHeader(subject, 'El asunto');
  const body = String(args.body || '');
  if (!body.trim()) throw new Error('El cuerpo del correo es obligatorio.');
  if (body.length > MAX_BODY_LENGTH) throw new Error('El cuerpo del correo excede el limite permitido.');

  const attachmentPaths = Array.isArray(args.attachment_paths)
    ? args.attachment_paths.map((item: string) => String(item || '').trim()).filter(Boolean)
    : [];
  if (attachmentPaths.length > MAX_ATTACHMENTS) throw new Error(`El correo excede el limite de ${MAX_ATTACHMENTS} adjuntos.`);

  return { to, subject, body, attachmentPaths, isHtml: args.is_html === true };
}

export function assertSafeExternalUrl(rawUrl: string): string {
  const input = String(rawUrl || '').trim();
  if (!input || input.length > 2048) throw new Error('URL invalida o demasiado larga.');
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Protocolo de URL no permitido: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password) throw new Error('No se permiten credenciales embebidas en URLs.');
  return parsed.toString();
}
