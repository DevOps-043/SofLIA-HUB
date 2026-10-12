import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockChat, getGeminiChatMocks } from './gemini-chat.setup';
const { mockChatsCreate } = getGeminiChatMocks();
const mocks = vi.hoisted(() => ({ provider: vi.fn() }));
vi.mock('../../services/openai-chat', () => ({ sendOpenAIMessageStream: mocks.provider }));
const { COMPUTER_USE_TOOLS } = await import('../../services/gemini-tools');
COMPUTER_USE_TOOLS.functionDeclarations.push({ name: 'open_application', description: 'Abrir', parameters: { type: 'OBJECT' } });
const { sendMessageStream } = await import('../../services/gemini-chat');
const { collectStreamText } = await import('../../services/gemini-chat/streams');
const { executeComputerTool, isComputerUseAvailable } = await import('../../services/computer-use-service');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isComputerUseAvailable).mockReturnValue(true);
  vi.mocked(executeComputerTool).mockResolvedValue(JSON.stringify({ success: true, window_verified: false }));
  mockChatsCreate.mockReturnValue(createMockChat('Respuesta del modelo'));
  mocks.provider.mockResolvedValue({ stream: (async function* () { yield 'Respuesta del modelo'; })(), sources: Promise.resolve(null) });
});

describe('apertura única desde el chat', () => {
  it.each(['gpt-6.1-sol', 'gemini-3.8-flash'])('ejecuta la orden reportada con %s sin inventar texto del modelo', async model => {
    const result = await sendMessageStream('usa el computer use y abre firefox', [], { model });
    expect(executeComputerTool).toHaveBeenCalledExactlyOnceWith('open_application', { path: 'firefox' }, expect.anything());
    expect(result.toolCalls).toMatchObject([{ name: 'open_application', args: { path: 'firefox' } }]);
    expect(await collectStreamText(result.stream)).toContain('no pude verificar su ventana');
    expect(mockChatsCreate).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it('una denegación de main se presenta como fallo', async () => {
    vi.mocked(executeComputerTool).mockResolvedValue('{"success":false,"error":"Sesión no autenticada"}');
    const result = await sendMessageStream('usa el computer use y abre firefox');
    expect(await collectStreamText(result.stream)).toContain('Sesión no autenticada');
  });
  it('el alcance de extractos no permite una apertura', async () => {
    await sendMessageStream('usa el computer use y abre firefox', [], { model: 'gpt-6.1-sol', browserSourceMode: 'attached-fragments' });
    expect(executeComputerTool).not.toHaveBeenCalled();
  });
  it('el catálogo restringido no se amplía', async () => {
    const skill = { id: 'prueba', name: 'Prueba', instructions: '', tools: [], workspaceId: null, allowedTools: [] };
    await sendMessageStream('usa el computer use y abre firefox', [], {
      model: 'gpt-6.1-sol',
      activeSkill: skill,
    });
    expect(executeComputerTool).not.toHaveBeenCalled();
  });
  it('una acción adicional conserva el coordinador', async () => {
    await sendMessageStream('usa el computer use y abre firefox y busca noticias', [], { model: 'gpt-6.1-sol' });
    expect(executeComputerTool).not.toHaveBeenCalled();
    expect(mocks.provider).toHaveBeenCalled();
  });
});
