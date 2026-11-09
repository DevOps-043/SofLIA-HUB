import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmTaskService } from '../llm-task-service';

const mocks = vi.hoisted(() => ({ client: vi.fn(), create: vi.fn() }));
vi.mock('../ai-provider/session-client', () => ({ getSessionOpenAIClient: mocks.client }));
const task = { prompt: 'Extrae el título', input: { texto: 'Dato no confiable' },
  schema: { type: 'object' as const, required: ['title'], properties: { title: { type: 'string' as const } } } };
beforeEach(() => { vi.clearAllMocks(); mocks.client.mockResolvedValue({ responses: { create: mocks.create } }); });

describe('Tareas JSON del workspace sobre OpenAI', () => {
  it('conserva prompt, schema y datos y no permite herramientas ni almacenamiento', async () => {
    mocks.create.mockResolvedValue({ output_text: '{"title":"Borrador"}' });
    expect(await new LlmTaskService().runJsonTask(task)).toEqual({ output: { title: 'Borrador' }, rawText: '{"title":"Borrador"}' });
    const body = mocks.create.mock.calls[0][0];
    expect(body).toMatchObject({ model: 'gpt-6-luna', store: false, max_output_tokens: 8192, reasoning: { effort: 'low' }, text: { format: { type: 'json_object' } } });
    expect(body.input).toContain('Extrae el título');
    expect(body.input).toContain('Dato no confiable');
    expect(body.input).toContain('"required"');
    expect(body).not.toHaveProperty('tools');
  });
  it('no entrega un resultado que incumple el schema aunque sea JSON válido', async () => {
    mocks.create.mockResolvedValue({ output_text: '{"title":12}' });
    await expect(new LlmTaskService().runJsonTask(task)).rejects.toThrow('no cumple el schema');
  });
  it('rechaza JSON inválido y ausencia de credencial sin fabricar un resultado', async () => {
    mocks.create.mockResolvedValue({ output_text: 'Respuesta inválida' });
    await expect(new LlmTaskService().runJsonTask(task)).rejects.toThrow();
    mocks.create.mockClear();
    mocks.client.mockRejectedValue(new Error('Sesión revocada'));
    await expect(new LlmTaskService().runJsonTask(task)).rejects.toThrow('Sesión revocada');
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
