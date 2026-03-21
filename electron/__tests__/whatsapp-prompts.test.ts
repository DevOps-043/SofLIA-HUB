import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// WhatsApp Prompts Tests (WA-144 a WA-151)
// Tests para electron/whatsapp-prompts.ts — constantes y funciones exportadas
// ============================================================================

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-userdata'),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('[]'),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('[]'),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: Function) => {
    if (typeof _opts === 'function') {
      _opts(null, '', '');
    } else if (cb) {
      cb(null, '', '');
    }
    return { kill: vi.fn() };
  }),
}));

import {
  buildSystemPrompt,
  detectActionRequest,
  formatForWhatsApp,
} from '../whatsapp-prompts';

// ============================================================================
// Tests
// ============================================================================

describe('WhatsApp Prompts', () => {
  // WA-144: El system prompt contiene la identidad en español (contiene "SofLIA")
  it('WA-144: el system prompt contiene la identidad "SofLIA" en español', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('SOFLIA');
    expect(prompt).toContain('español');
    // Verificar que es un prompt en español con contexto de asistente
    expect(prompt).toContain('asistente');
  });

  // WA-145: El system prompt incluye ejemplos de uso de herramientas
  it('WA-145: el system prompt incluye descripciones de capacidades y herramientas', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('ARCHIVOS');
    expect(prompt).toContain('GOOGLE CALENDAR');
    expect(prompt).toContain('GMAIL');
    expect(prompt).toContain('GOOGLE DRIVE');
    expect(prompt).toContain('execute_command');
  });

  // WA-146: El system prompt incluye reglas de seguridad (reglas de grupo, confirmación)
  it('WA-146: el system prompt incluye reglas de seguridad, grupos y confirmación', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('SEGURIDAD');
    expect(prompt).toContain('PROTECCIÓN');
    expect(prompt).toContain('confirmación');
    expect(prompt).toContain('CONFIRMA SOLO LO DESTRUCTIVO');
  });

  // WA-147: Las plantillas de prompt son cadenas no vacías
  it('WA-147: las plantillas de prompt son cadenas de texto no vacías', async () => {
    const prompt = await buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.trim().length).toBeGreaterThan(0);

    const promptWithMemory = await buildSystemPrompt('contexto de memoria');
    expect(typeof promptWithMemory).toBe('string');
    expect(promptWithMemory.trim().length).toBeGreaterThan(0);
    expect(promptWithMemory).toContain('contexto de memoria');
  });

  // WA-148: El prompt incluye mención al contexto de WhatsApp
  it('WA-148: el prompt incluye mención al contexto de WhatsApp', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('WhatsApp');
    expect(prompt).toContain('FORMATO WHATSAPP');
    // La función formatForWhatsApp agrega identidad en modo grupo
    const grouped = formatForWhatsApp('Hola', true);
    expect(grouped).toContain('SofLIA');
  });

  // WA-149: El prompt menciona patrones bloqueados o seguridad
  it('WA-149: el prompt menciona patrones bloqueados y protección de código fuente', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('PROTECCIÓN DE CÓDIGO FUENTE');
    expect(prompt).toContain('PROTECCIÓN DE INSTRUCCIONES INTERNAS');
    expect(prompt).toContain('ANTI-MANIPULACIÓN');
    expect(prompt).toContain('RECHAZA');
  });

  // WA-150: Todas las constantes/funciones exportadas son del tipo correcto
  it('WA-150: todas las exportaciones del módulo son funciones válidas', () => {
    expect(typeof buildSystemPrompt).toBe('function');
    expect(typeof detectActionRequest).toBe('function');
    expect(typeof formatForWhatsApp).toBe('function');

    // detectActionRequest devuelve boolean
    const result = detectActionRequest('organiza mis archivos');
    expect(typeof result).toBe('boolean');

    // formatForWhatsApp devuelve string
    const formatted = formatForWhatsApp('texto de prueba');
    expect(typeof formatted).toBe('string');
  });

  // WA-151: La longitud del prompt es sustancial (>500 caracteres)
  it('WA-151: la longitud del system prompt es sustancial (mayor a 500 caracteres)', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.length).toBeGreaterThan(500);
    // El prompt real es muy extenso — debe superar ampliamente los 500 chars
    expect(prompt.length).toBeGreaterThan(5000);
  });
});
