import { describe, expect, it } from 'vitest';
import './whatsapp-prompts.setup';
import {
  buildSystemPrompt,
  classifyEvidenceRequirement,
  detectActionRequest,
  formatForWhatsApp,
} from '../whatsapp-prompts';

describe('WhatsApp Prompts evidence helpers', () => {
  it('WA-150: todas las exportaciones del modulo son funciones validas', () => {
    expect(typeof buildSystemPrompt).toBe('function');
    expect(typeof classifyEvidenceRequirement).toBe('function');
    expect(typeof detectActionRequest).toBe('function');
    expect(typeof formatForWhatsApp).toBe('function');
    expect(typeof detectActionRequest('organiza mis archivos')).toBe('boolean');
    expect(typeof formatForWhatsApp('texto de prueba')).toBe('string');
  });

  it('WA-152: clasifica una verificacion local de forma generica', () => {
    expect(classifyEvidenceRequirement('Revisa en la aplicacion si el cambio esta guardado localmente')).toBe('local_visual');
    expect(classifyEvidenceRequirement('Solo abre la aplicacion')).toBe('none');
  });

  it('WA-153: clasifica comparaciones entre entorno local y remoto', () => {
    expect(classifyEvidenceRequirement('Revisa en la computadora que no haya nada local y que todo este en GitHub')).toBe('local_then_remote');
    expect(classifyEvidenceRequirement('Confirma en GitHub si ya esta subido')).toBe('remote');
  });

  it('WA-154: distingue cuando la revision local debe ser visual', () => {
    expect(classifyEvidenceRequirement('En la aplicacion de Antigravity revisa que no haya nada local y que todo este en GitHub')).toBe('local_visual_then_remote');
    expect(classifyEvidenceRequirement('Verifica visualmente en la ventana principal si ya quedo guardado')).toBe('local_visual');
  });

  it('WA-154b: exige evidencia remota para informacion actual o rotativa', () => {
    expect(classifyEvidenceRequirement('Mandame noticias relevantes de IA')).toBe('remote');
    expect(classifyEvidenceRequirement('Dame un dato curioso nuevo para hoy')).toBe('remote');
  });

  it('WA-155: detecta peticiones de investigacion como accion', () => {
    expect(detectActionRequest('Ayudame a investigar el capitulo 5 del CCNA')).toBe(true);
  });

  it('WA-155b: no trata preguntas sociales con puedes como acciones operativas', () => {
    expect(detectActionRequest('Puedes platicar conmigo un rato?')).toBe(false);
    expect(detectActionRequest('Puedes crear una presentacion de ventas?')).toBe(true);
  });

  it('WA-156: repara texto mojibake al formatear para WhatsApp', () => {
    expect(formatForWhatsApp('Ã‚Â¿En quÃƒÂ© puedo ayudarte?')).toContain('puedo ayudarte');
  });
});
