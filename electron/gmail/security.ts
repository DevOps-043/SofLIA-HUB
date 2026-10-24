import { gmailSendSchema } from '../../src/shared/gmail-delivery';
import type { SendEmailParams } from './types';

export function validateEmailMessageSecurity(params: SendEmailParams): SendEmailParams {
  const result = gmailSendSchema.safeParse(params);
  if (!result.success) throw new Error('El correo no cumple la validación de seguridad: revisa destinatarios, asunto, cuerpo y adjuntos.');
  return result.data;
}
