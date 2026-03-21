import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// WhatsApp Remote Hub Tests (WRH-001 to WRH-004)
// Tests for electron/whatsapp-remote-hub.ts
// ============================================================================

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
  },
}));

// Mock node:module createRequire (para systeminformation)
vi.mock('node:module', () => ({
  createRequire: vi.fn().mockReturnValue(
    vi.fn().mockReturnValue({
      currentLoad: vi.fn().mockResolvedValue({ currentLoad: 25 }),
      mem: vi.fn().mockResolvedValue({ free: 8e9, total: 16e9 }),
      cpuTemperature: vi.fn().mockResolvedValue({ main: 45 }),
    })
  ),
}));

// Mock archiver
vi.mock('archiver', () => ({
  default: vi.fn().mockReturnValue({
    on: vi.fn(),
    directory: vi.fn(),
    file: vi.fn(),
    finalize: vi.fn(),
  }),
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('contenido de prueba'),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}));

// Mock @whiskeysockets/baileys
vi.mock('@whiskeysockets/baileys', () => ({
  downloadMediaMessage: vi.fn().mockResolvedValue(Buffer.from('test')),
}));

import { SandboxGatekeeper, CommandInputSchema } from '../whatsapp-remote-hub';

// ============================================================================
// Tests
// ============================================================================

describe('WhatsAppRemoteHub - SandboxGatekeeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // WRH-001: Comando valido parseado con Zod
  it('WRH-001: comando valido es parseado correctamente con Zod', () => {
    const input = {
      text: 'dir C:\\Users',
      jid: '5551234567@s.whatsapp.net',
      messageId: 'msg-001',
    };

    const result = SandboxGatekeeper.validate(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBe('dir C:\\Users');
      expect(result.data.jid).toBe('5551234567@s.whatsapp.net');
      expect(result.data.messageId).toBe('msg-001');
    }
  });

  // WRH-002: Comando invalido rechazado
  it('WRH-002: comando invalido es rechazado por el esquema Zod', () => {
    // Texto vacio no pasa la validacion min(1)
    const inputVacio = {
      text: '',
      jid: '5551234567@s.whatsapp.net',
    };
    const resultVacio = SandboxGatekeeper.validate(inputVacio);
    expect(resultVacio.success).toBe(false);

    // Falta el campo jid (requerido)
    const inputSinJid = {
      text: 'echo hola',
    };
    const resultSinJid = SandboxGatekeeper.validate(inputSinJid);
    expect(resultSinJid.success).toBe(false);

    // Tipo incorrecto en text (numero en vez de string)
    const inputTipoMal = {
      text: 12345,
      jid: '5551234567@s.whatsapp.net',
    };
    const resultTipoMal = SandboxGatekeeper.validate(inputTipoMal);
    expect(resultTipoMal.success).toBe(false);
  });

  // WRH-003: Patrones peligrosos bloqueados (regex)
  it('WRH-003: patrones peligrosos son bloqueados por las expresiones regulares', () => {
    const patronesPeligrosos = [
      'rm -rf /',
      'del /S /Q C:\\',
      'format C:',
      'mkfs.ext4 /dev/sda1',
      'dd if=/dev/zero of=/dev/sda',
      'chmod -R 777 /',
      'chown -R root:root /',
      'sudo rm -rf /home',
      '> /dev/sda',
    ];

    for (const comando of patronesPeligrosos) {
      const result = SandboxGatekeeper.validate({
        text: comando,
        jid: '5551234567@s.whatsapp.net',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const mensajeError = result.error.errors.find(
          (e) => e.message.includes('bloqueado') || e.message.includes('Patrón peligroso')
        );
        expect(mensajeError).toBeDefined();
      }
    }
  });

  // WRH-004: Intentos de inyeccion bloqueados
  it('WRH-004: intentos de inyeccion de comandos son bloqueados', () => {
    const inyecciones = [
      'echo hola && rm -rf /',
      'ls; sudo rm -rf /tmp',
      'cat archivo.txt | dd if=/dev/zero of=/dev/sda',
      'whoami; chmod -R 777 /etc',
      'echo test; mkfs /dev/sda1',
    ];

    for (const inyeccion of inyecciones) {
      const result = SandboxGatekeeper.validate({
        text: inyeccion,
        jid: '5551234567@s.whatsapp.net',
        messageId: 'msg-inject-test',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const tieneErrorSeguridad = result.error.errors.some(
          (e) => e.message.includes('bloqueado') || e.message.includes('Patrón peligroso')
        );
        expect(tieneErrorSeguridad).toBe(true);
      }
    }

    // Verificar que un comando seguro con pipe SI pasa
    const comandoSeguro = SandboxGatekeeper.validate({
      text: 'echo hola | grep hola',
      jid: '5551234567@s.whatsapp.net',
    });
    expect(comandoSeguro.success).toBe(true);
  });
});

describe('CommandInputSchema - validacion directa', () => {
  it('acepta input con messageId opcional omitido', () => {
    const result = CommandInputSchema.safeParse({
      text: 'hostname',
      jid: '5551234567@s.whatsapp.net',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messageId).toBeUndefined();
    }
  });

  it('rechaza input completamente vacio', () => {
    const result = CommandInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
