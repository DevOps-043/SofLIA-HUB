import { describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../services/gmail-service';

describe('Wrapper de envío Gmail', () => {
  it.each([
    { success: true, messageId: 'mensaje-1' },
    { success: false, cancelled: true, error: 'Cancelado' },
    { success: false, uncertain: true, error: 'Revisa Enviados antes de repetir' },
  ] as const)('conserva el resultado explícito del main: %#', async result => {
    const send = vi.fn(async () => result);
    Object.assign(window, { gmail: { send } });
    const params = { to: ['dest@example.test'], subject: 'Asunto', body: 'Contenido', attachmentPaths: ['C:\\documentos\\informe.pdf'] };
    expect(await sendEmail(params)).toBe(result); expect(send).toHaveBeenCalledExactlyOnceWith(params);
    expect(send).toHaveBeenCalledOnce();
  });
});
