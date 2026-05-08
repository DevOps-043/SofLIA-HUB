import { describe, it, expect, vi, beforeEach } from 'vitest';
import './whatsapp-remote-hub.setup';
import { commandInjections, dangerousPatterns, hasSecurityError } from './whatsapp-remote-hub.fixtures';
import { SandboxGatekeeper, CommandInputSchema } from '../whatsapp-remote-hub';

describe('WhatsAppRemoteHub - SandboxGatekeeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('WRH-001: comando valido es parseado correctamente con Zod', () => {
    const result = SandboxGatekeeper.validate({
      text: 'dir C:\\Users',
      jid: '5551234567@s.whatsapp.net',
      messageId: 'msg-001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('dir C:\\Users');
      expect(result.data.jid).toBe('5551234567@s.whatsapp.net');
      expect(result.data.messageId).toBe('msg-001');
    }
  });

  it('WRH-002: comando invalido es rechazado por el esquema Zod', () => {
    expect(SandboxGatekeeper.validate({ text: '', jid: '5551234567@s.whatsapp.net' }).success).toBe(false);
    expect(SandboxGatekeeper.validate({ text: 'echo hola' }).success).toBe(false);
    expect(SandboxGatekeeper.validate({ text: 12345, jid: '5551234567@s.whatsapp.net' }).success).toBe(false);
  });

  it('WRH-003: patrones peligrosos son bloqueados por las expresiones regulares', () => {
    for (const text of dangerousPatterns) {
      const result = SandboxGatekeeper.validate({ text, jid: '5551234567@s.whatsapp.net' });
      expect(result.success).toBe(false);
      if (!result.success) expect(hasSecurityError(result)).toBe(true);
    }
  });

  it('WRH-004: intentos de inyeccion de comandos son bloqueados', () => {
    for (const text of commandInjections) {
      const result = SandboxGatekeeper.validate({ text, jid: '5551234567@s.whatsapp.net', messageId: 'msg-inject-test' });
      expect(result.success).toBe(false);
      if (!result.success) expect(hasSecurityError(result)).toBe(true);
    }
    expect(SandboxGatekeeper.validate({ text: 'echo hola | grep hola', jid: '5551234567@s.whatsapp.net' }).success).toBe(true);
  });
});

describe('CommandInputSchema - validacion directa', () => {
  it('acepta input con messageId opcional omitido', () => {
    const result = CommandInputSchema.safeParse({ text: 'hostname', jid: '5551234567@s.whatsapp.net' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.messageId).toBeUndefined();
  });

  it('rechaza input completamente vacio', () => {
    expect(CommandInputSchema.safeParse({}).success).toBe(false);
  });
});
