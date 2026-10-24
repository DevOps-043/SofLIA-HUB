import type { CalendarService } from '../calendar-service';
import { calendarSession } from '../calendar/session-context';
import { createLogger } from '../utils/logger';
import type { GmailSendResult } from '../../src/shared/gmail-delivery';
import { validateEmailMessageSecurity } from './security';
import { buildRawMessage } from './raw-message';
import type { GmailClient, SendEmailParams } from './types';

export interface GmailSendAuthorization {
  userId: string;
  assertCurrent(): void;
  signal?: AbortSignal;
  approve(detail: string, assertCurrent: () => void): Promise<boolean>;
}

const log = createLogger('gmail-envio');
const SEND_TIMEOUT_MS = 15_000;
export const GMAIL_SEND_FAILED = 'No se pudo preparar o autorizar el correo. Revisa la conexión, los datos y los adjuntos.';
export const GMAIL_SEND_UNCERTAIN = 'No se pudo confirmar el envío. Revisa Enviados en Gmail antes de repetirlo; el mensaje podría haberse enviado.';

export async function sendGmailEmail(
  getClient: () => Promise<{ client?: GmailClient; error?: string }>,
  calendar: CalendarService,
  input: SendEmailParams,
  authorization?: GmailSendAuthorization,
): Promise<GmailSendResult> {
  let attempted = false;
  try {
    const params = validateEmailMessageSecurity(input);
    const connection = calendar.connections.get('google');
    if (!connection || !connection.isActive || !calendar.userId || connection.userId !== calendar.userId
      || (authorization && authorization.userId !== calendar.userId)) throw new Error('connection_invalid');
    const sessionAssert = calendarSession(calendar, connection);
    const email = connection.email;
    const assertCurrent = () => {
      authorization?.assertCurrent(); sessionAssert();
      if (authorization?.signal?.aborted) throw new Error('send_cancelled');
      if (connection.email !== email) throw new Error('connection_changed');
    };
    assertCurrent();
    // La aprobación queda ligada a estos bytes; no se vuelven a abrir las rutas.
    const prepared = await buildRawMessage(params, assertCurrent);
    assertCurrent();
    if (authorization) {
      const detail = [
        `Cuenta: ${email}`, `Para: ${params.to.join(', ')}`,
        `CC: ${(params.cc ?? []).join(', ')}`, `CCO: ${(params.bcc ?? []).join(', ')}`,
        `Asunto: ${params.subject}`, `Formato: ${params.isHtml ? 'HTML (código fuente)' : 'texto'}`,
        `Adjuntos preparados: ${prepared.attachments.length}`,
        ...prepared.attachments.map(file => `${file.path} (${file.bytes} bytes)`),
        '', 'Contenido completo:', params.body,
      ].join('\n');
      if (!await authorization.approve(detail, assertCurrent)) {
        assertCurrent(); return { success: false, cancelled: true, error: 'Envío cancelado.' };
      }
      assertCurrent();
    }
    const { client } = await getClient();
    assertCurrent();
    if (!client) throw new Error('client_unavailable');
    const raw = prepared.raw.toString('base64url');
    assertCurrent();
    attempted = true;
    const requestSignal = AbortSignal.timeout(SEND_TIMEOUT_MS);
    const signal = authorization?.signal ? AbortSignal.any([authorization.signal, requestSignal]) : requestSignal;
    const response = await client.users.messages.send({ userId: 'me', requestBody: { raw } }, { timeout: SEND_TIMEOUT_MS, retry: false, signal });
    assertCurrent();
    const messageId: unknown = response?.data?.id;
    if (typeof messageId !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(messageId)) throw new Error('invalid_acknowledgement');
    log.info('Envío Gmail confirmado por el proveedor.');
    return { success: true, messageId };
  } catch {
    log.warn({ transportStarted: attempted }, 'No se confirmó el envío Gmail.');
    return { success: false, ...(attempted ? { uncertain: true } : {}), error: attempted ? GMAIL_SEND_UNCERTAIN : GMAIL_SEND_FAILED };
  }
}
