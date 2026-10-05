import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ gemini: vi.fn(), openai: vi.fn(), tokens: vi.fn() }));
vi.mock('../../services/gemini-chat/client', () => ({ getGenAiClient: async () => ({ models: { generateContent: mocks.gemini } }) }));
vi.mock('../../services/openai-chat/client', () => ({ getOpenAI: async () => ({ responses: { create: mocks.openai } }) }));
vi.mock('../../services/model-quota', () => ({ SOFLIA_MAX_MODEL_ID: 'gpt-6-sol', recordSofliaMaxTokens: mocks.tokens }));
import { prepareChatTeam } from '../../services/gemini-chat/agent-team';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gemini.mockResolvedValue({ text: 'Aporte Gemini' });
  mocks.openai.mockResolvedValue({ output_text: 'Aporte OpenAI', usage: { total_tokens: 30 } });
});
describe('Equipos en chat y páginas', () => {
  it('conserva modelo Gemini y usa solo el texto suministrado sin herramientas', async () => {
    const onToolCall = vi.fn();
    const result = await prepareChatTeam({ message: 'Revisa esta página', source: '[P1:F1] Texto autorizado', modelId: 'gemini-3.8-flash', options: { browserSourceMode: 'attached-fragments', onToolCall } });
    expect(mocks.gemini).toHaveBeenCalledTimes(2);
    for (const [request] of mocks.gemini.mock.calls) {
      expect(request.model).toBe('gemini-3.8-flash');
      expect(request.contents).toContain('[P1:F1]');
      expect(request.config).not.toHaveProperty('tools');
      expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
    }
    expect(mocks.openai).not.toHaveBeenCalled();
    expect(result.context).toContain('Aporte Gemini');
    expect(onToolCall.mock.calls[onToolCall.mock.calls.length - 1]?.[0].result).toContain('completed');
  });
  it('usa el modelo OpenAI elegido sin búsquedas y registra consumo de Max', async () => {
    const result = await prepareChatTeam({ message: 'Crea una presentación', source: 'Datos', modelId: 'gpt-6-sol', options: { userId: 'actor', thinking: { id: 'high', level: 'high' } } });
    expect(mocks.openai).toHaveBeenCalledTimes(2);
    expect(mocks.openai.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-sol', store: false, reasoning: { effort: 'high' } });
    expect(mocks.openai.mock.calls[0][0]).not.toHaveProperty('tools');
    expect(mocks.tokens).toHaveBeenCalledWith('actor', 30);
    expect(result.context).toContain('Aporte OpenAI');
  });
  it('modo directo y saludo no contactan proveedores', async () => {
    for (const message of ['Hola', 'modo directo: Crea un informe']) {
      expect((await prepareChatTeam({ message, source: '', modelId: 'gpt-6-sol' })).context).toBe('');
    }
    expect(mocks.gemini).not.toHaveBeenCalled(); expect(mocks.openai).not.toHaveBeenCalled();
  });
  it('falla sin contaminar el contexto y permite continuar al coordinador', async () => {
    mocks.gemini.mockRejectedValue(new Error('detalle privado'));
    expect(await prepareChatTeam({ message: 'Crea un informe', source: '', modelId: 'gemini-3.8-flash' })).toEqual({ context: '', instruction: '' });
  });
});
