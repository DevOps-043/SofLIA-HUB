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
});
