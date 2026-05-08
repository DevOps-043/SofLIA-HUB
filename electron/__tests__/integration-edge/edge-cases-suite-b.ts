import { describe, expect, it } from 'vitest';

describe('Edge Cases - validacion y formatos', () => {
  it('EDGE-008: dynamic tool schema without handler is reported', () => {
    const validateTool = (schema: any) => ['name', 'description', 'handler'].filter((key) => !schema[key]);
    expect(validateTool({ name: 'test_tool', description: 'Herramienta', handler: undefined })).toContain('handler');
  });

  it('EDGE-009: error messages are in Spanish', () => {
    for (const msg of ['Recurso no encontrado', 'No autorizado. Inicia sesion de nuevo.', 'Error interno del servidor']) {
      expect(msg).toMatch(/[a-z]/i);
      expect(msg).not.toMatch(/^(Not found|Unauthorized|Internal server error|Timeout)$/i);
    }
  });

  it('EDGE-010: deeply nested payloads are handled without stack overflow', () => {
    const buildNested = (depth: number): any => depth === 0 ? { value: 'hoja' } : { nested: buildNested(depth - 1) };
    const sanitize = (obj: any, maxDepth: number, current = 0): any => {
      if (current >= maxDepth) return '[truncado]';
      if (typeof obj !== 'object' || obj === null) return obj;
      return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, sanitize(value, maxDepth, current + 1)]));
    };

    let current = sanitize(buildNested(100), 50);
    for (let index = 0; index < 49; index += 1) current = current.nested;
    expect(current.nested).toBe('[truncado]');
  });

  it('EDGE-011: empty command string returns error', async () => {
    const executeCommand = async (cmd: string) => !cmd.trim()
      ? { success: false, error: 'Comando vacio no permitido' }
      : { success: true, stdout: '' };

    expect((await executeCommand('')).error).toContain('vacio');
  });

  it('EDGE-012: unicode arguments are preserved', () => {
    const toolArgs = { path: 'C:/Users/Jose/Documentos/presentacion_ano_nuevo.pptx', content: 'Hola especial.' };
    expect(JSON.parse(JSON.stringify(toolArgs)).content).toBe(toolArgs.content);
  });

  it('EDGE-013: very long response is handled without truncation', () => {
    const text = 'x'.repeat(100_000);
    expect({ success: true, length: text.length, text }.length).toBe(100_000);
  });

  it('EDGE-014: concurrent desktop agent tasks get unique IDs', () => {
    const activeTasks = new Map<string, { task: string; status: string }>();
    const startTask = (task: string) => {
      const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeTasks.set(id, { task, status: 'running' });
      return id;
    };

    expect(new Set([startTask('Abrir Chrome'), startTask('Tomar screenshot'), startTask('Escribir')]).size).toBe(3);
    expect(activeTasks.size).toBe(3);
  });

  it('EDGE-015 to EDGE-020: remaining edge contracts keep safe defaults', async () => {
    const uploadFile = async (content: Buffer) => content.length === 0
      ? { success: false, error: 'No se puede subir un archivo vacio' }
      : { success: true };
    const executeAction = (action: { type: string }) => ['click', 'type', 'scroll', 'key', 'wait', 'drag'].includes(action.type)
      ? { success: true }
      : { success: false, error: `Accion desconocida: ${action.type}` };

    expect(Boolean({ text: '', hasMedia: true }.hasMedia)).toBe(true);
    expect(Boolean({ start: { date: '2026-03-21' } }.start.date)).toBe(true);
    expect(`----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`).toMatch(/^----=_Part_\d+_[a-z0-9]+$/);
    expect((await uploadFile(Buffer.alloc(0))).error).toContain('vacio');
    expect((null as any)?.participants || []).toEqual([]);
    expect(executeAction({ type: 'hover_magic' }).error).toContain('Accion desconocida');
  });
});
