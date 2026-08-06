import { describe, expect, it } from 'vitest';
import {
  createAssistantTextSanitizer,
  sanitizeAssistantText,
} from '../../services/gemini-chat/assistant-text-sanitizer';

/** Emite el texto en trozos de `size` para simular los deltas del stream. */
function streamThrough(text: string, size: number): string {
  const sanitizer = createAssistantTextSanitizer();
  let output = '';
  for (let index = 0; index < text.length; index += size) {
    output += sanitizer.push(text.slice(index, index + size));
  }
  return output + sanitizer.flush();
}

describe('saneado del canal visible del asistente', () => {
  it('ATS-001: elimina el andamiaje filtrado del caso reportado', () => {
    const leaked = 'Revisando ahora el estado visible de Codex y el chat de Pedro.'
      + '{"task":"Inspecciona la pantalla actual y localiza la ventana de Codex.","backend":"computer"}'
      + '<|assistant to=use_computer code|>'
      + '{"task":"Inspecciona la pantalla actual y localiza la ventana de Codex."}'
      + 'No puedo verificar todavía qué corrigió Codex.';

    const expected = 'Revisando ahora el estado visible de Codex y el chat de Pedro.'
      + 'No puedo verificar todavía qué corrigió Codex.';

    expect(sanitizeAssistantText(leaked)).toBe(expected);
    // El andamiaje llega partido entre deltas: el resultado no puede depender
    // del tamaño del fragmento.
    for (const size of [1, 3, 7, 40, 500]) {
      expect(streamThrough(leaked, size)).toBe(expected);
    }
  });

  it('ATS-002: elimina tokens de control aunque lleguen partidos', () => {
    const leaked = 'Antes<|channel|>commentary<|message|>Después';
    expect(sanitizeAssistantText(leaked)).toBe('AntesDespués');
    for (const size of [1, 2, 5, 9]) {
      expect(streamThrough(leaked, size)).toBe('AntesDespués');
    }
  });

  it('ATS-003: conserva JSON legítimo que no corresponde a una herramienta', () => {
    const legitimate = 'La configuración quedó así: {"idioma":"es","tema":"oscuro"} y ya está aplicada.';
    expect(sanitizeAssistantText(legitimate)).toBe(legitimate);
    expect(streamThrough(legitimate, 4)).toBe(legitimate);
  });

  it('ATS-004: no toca el contenido dentro de un bloque de código', () => {
    const fenced = 'Ejemplo de llamada:\n```json\n{"task":"abrir una app","backend":"desktop"}\n```\nEso es todo.';
    expect(sanitizeAssistantText(fenced)).toBe(fenced);
    for (const size of [1, 6, 25]) {
      expect(streamThrough(fenced, size)).toBe(fenced);
    }
  });

  it('ATS-005: conserva prosa con llaves y comparaciones sueltas', () => {
    const prose = 'Usa {n} como marcador y verifica que a < b antes de continuar.';
    expect(sanitizeAssistantText(prose)).toBe(prose);
    for (const size of [1, 3, 11]) {
      expect(streamThrough(prose, size)).toBe(prose);
    }
  });

  it('ATS-006: un objeto sin cerrar al final se muestra en vez de perderse', () => {
    const truncated = 'Resultado parcial {"task":"quedó cortado por el límite';
    expect(sanitizeAssistantText(truncated)).toBe(truncated);
    expect(streamThrough(truncated, 5)).toBe(truncated);
  });

  it('ATS-007: no descarta texto cuando el fragmento termina en una marca parcial', () => {
    const sanitizer = createAssistantTextSanitizer();
    const first = sanitizer.push('Fin de la frase <');
    expect(first).toBe('Fin de la frase ');
    expect(first + sanitizer.push('3 unidades.') + sanitizer.flush()).toBe('Fin de la frase <3 unidades.');
  });
});
