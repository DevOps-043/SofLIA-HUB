import { describe, expect, it } from 'vitest';
import { buildSafeGmailSendParams } from '../../services/gemini-chat/email-security';

describe('gemini-chat Gmail security', () => {
  it('GCHAT-SEC-001: normalizes comma-separated recipients', () => {
    const params = buildSafeGmailSendParams({
      to: 'uno@test.com, dos@test.com',
      subject: 'Hola',
      body: 'Contenido',
    });

    expect(params.to).toEqual(['uno@test.com', 'dos@test.com']);
  });

  it('GCHAT-SEC-002: blocks recipient header injection', () => {
    expect(() => buildSafeGmailSendParams({
      to: 'valid@test.com\r\nBcc: attacker@test.com',
      subject: 'Hola',
      body: 'Contenido',
    })).toThrow(/invalido|inseguro/i);
  });

  it('GCHAT-SEC-003: blocks subject header injection', () => {
    expect(() => buildSafeGmailSendParams({
      to: 'valid@test.com',
      subject: 'Hola\r\nBcc: attacker@test.com',
      body: 'Contenido',
    })).toThrow(/control/i);
  });

  it('rechaza el exceso de adjuntos sin recortar silenciosamente la solicitud', () => {
    expect(() => buildSafeGmailSendParams({ to: 'dest@example.test', subject: 'Informe', body: 'Contenido',
      attachment_paths: Array.from({ length: 11 }, (_, index) => `C:\\documentos\\${index}.pdf`) })).toThrow();
  });

  it('conserva todos los adjuntos válidos y sus rutas en orden', () => {
    const paths = Array.from({ length: 10 }, (_, index) => `C:\\documentos\\${index}.pdf`);
    expect(buildSafeGmailSendParams({ to: 'dest@example.test', subject: 'Informe', body: 'Contenido', attachment_paths: paths }).attachmentPaths).toEqual(paths);
  });

  it.each([
    { attachment_paths: [''] }, { attachment_paths: [null] }, { body: 123 }, { is_html: 'false' }, { to: Array(21).fill('dest@example.test') },
  ])('rechaza tipos y valores inválidos sin convertirlos ni omitirlos: %#', value => {
    expect(() => buildSafeGmailSendParams({ to: 'dest@example.test', subject: 'Informe', body: 'Contenido', ...value })).toThrow();
  });
});
