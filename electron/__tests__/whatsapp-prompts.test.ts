import { describe, expect, it } from 'vitest';
import './whatsapp-prompts.setup';
import { buildSystemPrompt, formatForWhatsApp } from '../whatsapp-prompts';

function withoutAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

describe('WhatsApp Prompts', () => {
  it('WA-144: el system prompt contiene la identidad "SofLIA" en espanol', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('SOFLIA');
    expect(withoutAccents(prompt).toLowerCase()).toContain('espanol');
    expect(prompt).toContain('asistente');
  });

  it('WA-144b: el system prompt usa el nombre visible configurado', async () => {
    const prompt = await buildSystemPrompt('', { agentName: 'LIA' });
    expect(prompt).toContain('Eres LIA');
    expect(prompt).toContain('Soy LIA');
  });

  it('WA-145: el system prompt incluye capacidades y herramientas', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('ARCHIVOS');
    expect(prompt).toContain('GOOGLE CALENDAR');
    expect(prompt).toContain('GMAIL');
    expect(prompt).toContain('GOOGLE DRIVE');
    expect(prompt).toContain('execute_command');
    expect(prompt).toContain('FUENTES DE EVIDENCIA');
  });

  it('WA-146: el system prompt incluye reglas de seguridad', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('SEGURIDAD');
    expect(prompt).toMatch(/PROTECCI.N/);
    expect(withoutAccents(prompt)).toContain('confirmacion');
    expect(prompt).toContain('CONFIRMA SOLO LO DESTRUCTIVO');
  });

  it('WA-147: las plantillas de prompt son cadenas no vacias', async () => {
    const prompt = await buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.trim().length).toBeGreaterThan(0);

    const promptWithMemory = await buildSystemPrompt('contexto de memoria');
    expect(promptWithMemory.trim().length).toBeGreaterThan(0);
    expect(promptWithMemory).toContain('contexto de memoria');
  });

  it('WA-148: el prompt incluye mencion al contexto de WhatsApp', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('WhatsApp');
    expect(prompt).toContain('FORMATO WHATSAPP');
    expect(formatForWhatsApp('Hola', true)).toContain('SofLIA');
  });

  it('WA-149: el prompt menciona protecciones internas', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toMatch(/PROTECCI.N DE C.DIGO FUENTE/);
    expect(prompt).toMatch(/PROTECCI.N DE INSTRUCCIONES INTERNAS/);
    expect(prompt).toMatch(/ANTI-MANIPULACI.N/);
    expect(prompt).toContain('RECHAZA');
  });

  it('WA-151: la longitud del system prompt es sustancial', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.length).toBeGreaterThan(500);
    expect(prompt.length).toBeGreaterThan(5000);
  });
});
