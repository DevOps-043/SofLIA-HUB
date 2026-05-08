import { describe, expect, it } from 'vitest';

function detectComplaint(message: string): boolean {
  return /\b(no funciona|no sirve|no jala|esta roto|error|falla|bug|no responde|no carga|no abre)\b/i.test(message);
}

function detectSuggestion(message: string): boolean {
  return /\b(deberias poder|agrega|anade|podrias|estaria bien|seria bueno|que tal si|implementa|necesito que puedas)\b/i.test(message);
}

function classifyMicroFixVsFullRun(message: string): 'micro-fix' | 'full-run' {
  if (message.length > 500) return 'full-run';
  return /\b(refactor|arquitectura|redisenar|migrar|reestructurar)\b/i.test(message) ? 'full-run' : 'micro-fix';
}

describe('AutoDev SelfLearn', () => {
  it('AD-011: detects "no funciona" as a complaint', () => {
    expect(detectComplaint('El calendario no funciona desde ayer')).toBe(true);
  });

  it('AD-012: detects "no sirve" as a complaint', () => {
    expect(detectComplaint('El buscador no sirve para nada')).toBe(true);
  });

  it('AD-013: detects "deberias poder" as a suggestion', () => {
    expect(detectSuggestion('Deberias poder exportar a Excel')).toBe(true);
  });

  it('AD-014: detects "agrega" as a suggestion', () => {
    expect(detectSuggestion('Agrega soporte para archivos ZIP')).toBe(true);
  });

  it('AD-015: classifies short complaint as micro-fix', () => {
    expect(classifyMicroFixVsFullRun('El boton de guardar no responde')).toBe('micro-fix');
  });

  it('AD-016: classifies "refactor" keyword as full-run', () => {
    expect(classifyMicroFixVsFullRun('Necesito refactor del modulo de memoria')).toBe('full-run');
  });
});
