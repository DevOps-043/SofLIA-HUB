import { gmailSendSchema, hasUnsafeGmailHeader, type SendEmailParams } from '../../shared/gmail-delivery';

function recipients(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (hasUnsafeGmailHeader(value)) throw new Error('Correo inválido o inseguro: contiene caracteres de control.');
  return value.split(',').map(item => item.trim());
}

/** Adapta nombres de herramienta sin descartar destinatarios ni adjuntos. */
export function buildSafeGmailSendParams(args: Record<string, unknown>): SendEmailParams {
  const result = gmailSendSchema.safeParse({
    to: recipients(args.to), subject: args.subject, body: args.body,
    isHtml: args.is_html ?? false, attachmentPaths: args.attachment_paths,
  });
  if (!result.success) throw new Error('Datos de correo inválidos o inseguros: revisa tipos, límites y caracteres de control.');
  return result.data;
}
