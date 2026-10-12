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
      expect(request.config.thinkingConfig.thinkingLevel).toBe('LOW');
    }
    expect(mocks.openai).not.toHaveBeenCalled();
    expect(result.context).toContain('Aporte Gemini');
    expect(onToolCall.mock.calls[onToolCall.mock.calls.length - 1]?.[0].result).toContain('completed');
  });
  it('usa el modelo OpenAI elegido sin búsquedas y registra consumo de Max', async () => {
    const result = await prepareChatTeam({ message: 'Crea una presentación', source: 'Datos', modelId: 'gpt-6-sol', options: { userId: 'actor', thinking: { id: 'high', level: 'high' } } });
    expect(mocks.openai).toHaveBeenCalledTimes(2);
    expect(mocks.openai.mock.calls[0][0]).toMatchObject({ model: 'gpt-6-sol', store: false, reasoning: { effort: 'low' } });
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
    const result = await prepareChatTeam({ message: 'Crea un informe', source: '', modelId: 'gemini-3.8-flash' });
    expect(result.context).toBe('');
    expect(result.instruction).toContain('"aportesCompletos":0');
    expect(result.instruction).not.toContain('detalle privado');
  });
  it.each(['gpt-6-sol', 'gemini-3.8-flash'])('activa un seguimiento en %s con el encargo del mismo chat', async modelId => {
    const result = await prepareChatTeam({
      message: 'usa los multiagentes para que cada uno proponga algo diferente', source: 'Seguimiento', modelId,
      conversationHistory: [
        { role: 'user', text: 'Propongan una activación breve para Rethink & Delight' },
        { role: 'model', text: 'Una mordida, otra mirada' },
      ],
    });
    const calls = modelId.startsWith('gpt') ? mocks.openai.mock.calls : mocks.gemini.mock.calls;
    expect(calls).toHaveLength(2);
    for (const [request] of calls) {
      const payload = JSON.parse(request.input ?? request.contents);
      expect(payload.datosNoConfiables).toContain('Rethink & Delight');
      expect(payload.datosNoConfiables).toContain('HISTORIAL_RECIENTE_NO_CONFIABLE');
    }
    expect(result.instruction).toContain('"aportesCompletos":2');
    expect(result.context).toContain('APORTES_EQUIPO_NO_CONFIABLES');
  });
  it('acota historial sin mezclar conversaciones y lo etiqueta como datos', async () => {
    await prepareChatTeam({ message: 'usa los multiagentes', source: 'Fuente del turno', modelId: 'gemini-3.8-flash', conversationHistory: [
      { role: 'user', text: 'Mensaje antiguo omitido' },
      ...Array.from({ length: 5 }, () => ({ role: 'user' as const, text: 'Contexto reciente' })),
      { role: 'model', text: 'x'.repeat(9_000) },
    ] });
    const source = JSON.parse(mocks.gemini.mock.calls[0][0].contents).datosNoConfiables;
    expect(source).not.toContain('Mensaje antiguo omitido');
    const history = JSON.parse(source.split('HISTORIAL_RECIENTE_NO_CONFIABLE\n')[1].split('\nFIN_')[0]);
    expect(history.truncado).toBe(true);
    expect(history.mensajes).toHaveLength(6);
    expect(source).toContain('Contexto reciente');
    expect(history.mensajes.map((entry: { text: string }) => entry.text).join('').length).toBeLessThanOrEqual(8_000);
    const next = await prepareChatTeam({ message: 'usa los multiagentes', source: 'Otro chat', modelId: 'gemini-3.8-flash' });
    expect(mocks.gemini.mock.calls[2][0].contents).not.toContain('Contexto reciente');
    expect(next.context).toContain('Aporte Gemini');
  });
  it('conserva el encargo reciente aunque la fuente actual ocupe todo el presupuesto', async () => {
    await prepareChatTeam({ message: 'usa los multiagentes', source: 's'.repeat(24_000), modelId: 'gemini-3.8-flash', conversationHistory: [
      { role: 'user', text: 'Activación breve para Rethink & Delight' },
      { role: 'model', text: 'Una propuesta larga'.repeat(1000) },
    ] });
    const source = JSON.parse(mocks.gemini.mock.calls[0][0].contents).datosNoConfiables;
    expect(source.length).toBeLessThanOrEqual(24_000);
    expect(source).toContain('FUENTE_ACTUAL_TRUNCADA');
    expect(source).toContain('Rethink & Delight');
    expect(source).toContain('FIN_HISTORIAL_RECIENTE_NO_CONFIABLE');
  });
  it('acota también la representación JSON del historial con caracteres escapados', async () => {
    await prepareChatTeam({ message: 'usa los multiagentes', source: 's'.repeat(24_000), modelId: 'gemini-3.8-flash', conversationHistory: [
      { role: 'user', text: 'Encargo original' }, { role: 'model', text: '\u0000'.repeat(8_000) },
    ] });
    const source = JSON.parse(mocks.gemini.mock.calls[0][0].contents).datosNoConfiables;
    expect(source.length).toBeLessThanOrEqual(24_000);
    expect(source).toContain('Encargo original');
    expect(source).toContain('FIN_HISTORIAL_RECIENTE_NO_CONFIABLE');
  });
  it('publica con identidad SOFIA aunque el propietario de datos Lia sea distinto', async () => {
    const publish = vi.fn(async () => ({ success: true, data: [] }));
    Object.defineProperty(window, 'agentActivity', { configurable: true, value: { publish } });
    try {
      await prepareChatTeam({ message: 'usa los multiagentes', source: '', modelId: 'gpt-6-sol', options: { userId: 'lia', activityOwnerId: 'sofia', thinking: { id: 'max', level: 'max' } } });
      expect(publish).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'sofia' }));
      expect(mocks.openai.mock.calls[0][0].reasoning).toEqual({ effort: 'low' });
      expect(mocks.tokens).toHaveBeenCalledWith('lia', 30);
    } finally { Reflect.deleteProperty(window, 'agentActivity'); }
  });
});
