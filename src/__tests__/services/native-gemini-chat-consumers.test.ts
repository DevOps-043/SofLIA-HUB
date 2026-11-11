import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NativeGeminiRequest } from '../../shared/native-gemini-conversation';
import { getGeminiChatMocks } from './gemini-chat.setup';
import { withGeminiConversation } from '../../services/gemini-chat/conversation';
import { collectStreamText, singleChunkStream } from '../../services/gemini-chat/streams';
import { runResearchActionPhase } from '../../services/gemini-chat/research-action';
import { supabase } from '../../lib/supabase';
import { generateTitleWithModel } from '../../services/chat/operations/title';
import { improveBrowserSelection } from '../../services/browser-writing';
import { optimizePrompt } from '../../services/gemini-chat/prompt-optimizer';
import { prepareChatTeam } from '../../services/gemini-chat/agent-team';

const openai = vi.hoisted(() => ({ create: vi.fn<(body: unknown) => Promise<{ output_text: string }>>(async () => ({ output_text: 'Respuesta nativa' })) }));
vi.mock('../../services/openai-chat/client', () => ({ getOpenAI: async () => ({ responses: { create: openai.create } }) }));

const id = '11111111-1111-1111-1111-111111111111';
const mocks = getGeminiChatMocks();
const setup = { model: 'gemini-3.8-flash', config: {}, history: [] };
function installBridge() {
  const request = vi.fn(async (input: NativeGeminiRequest) => {
    if (input.operation === 'open') return { success: true as const, turnId: id };
    if (input.operation === 'close') return { success: true as const, closed: true as const };
    return { success: true as const, response: { text: 'Respuesta nativa', candidates: [{ content: { parts: [{ text: 'Respuesta nativa' }] } }] } };
  });
  window.geminiConversation = { request };
  return request;
}
afterEach(() => {
  Reflect.deleteProperty(window, 'geminiConversation');
  vi.clearAllMocks();
});

describe('Consumidores de conversación Gemini nativa', () => {
  it('el chat normal pasa modelo, historial y mensaje por el puente', async () => {
    const request = installBridge();
    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('Hola', [{ role: 'user', text: 'Antes' }, { role: 'model', text: 'Respuesta anterior' }]);
    expect(await collectStreamText(result.stream)).toBe('Respuesta nativa');
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual(['open', 'send', 'close']);
    expect(request.mock.calls[0][0]).toMatchObject({ model: 'gemini-3.8-flash', history: [{ role: 'user', parts: [{ text: 'Antes' }] }, { role: 'model' }] });
    expect(mocks.mockGetApiKeyWithCache).not.toHaveBeenCalled();
  });

  it('la fase de acciones recibe la investigación por el mismo puente', async () => {
    const request = installBridge();
    const result = await runResearchActionPhase({
      grounded: { stream: singleChunkStream('Investigación verificada'), sources: Promise.resolve(null) },
      originalMessage: 'Crea un documento', systemInstruction: 'Prueba', history: [], generationConfig: {},
      candidateModelIds: ['gemini-3.8-flash'], computerUseEnabled: false,
    });
    expect(await collectStreamText(result.stream)).toContain('Respuesta nativa');
    expect(request.mock.calls[1][0]).toMatchObject({ operation: 'send', message: expect.stringContaining('Investigación verificada') });
    expect(mocks.mockGetApiKeyWithCache).not.toHaveBeenCalled();
  });

  it('los especialistas usan inferencia nativa sin catálogo de acciones', async () => {
    const request = installBridge();
    const result = await prepareChatTeam({ message: 'Usa los multiagentes', source: 'Evidencia', modelId: 'gemini-3.8-flash', options: { teamMode: 'team' } });
    expect(result.context).toContain('Respuesta nativa');
    expect(request).not.toHaveBeenCalled();
    expect(openai.create).toHaveBeenCalledTimes(2);
    for (const [body] of openai.create.mock.calls) expect(body).not.toHaveProperty('tools');
    expect(mocks.mockGetApiKeyWithCache).not.toHaveBeenCalled();
  });

  it('títulos, redacción y optimización usan turnos de texto nativos', async () => {
    const request = installBridge();
    await expect(generateTitleWithModel([{ id: 'ficticio', role: 'user', text: 'Consulta inicial', timestamp: 0 }])).resolves.toBe('Respuesta nativa');
    await expect(improveBrowserSelection({ text: 'Texto de prueba', prompt: '' })).resolves.toBe('Respuesta nativa');
    await expect(optimizePrompt('Petición ficticia', 'chatgpt')).resolves.toBe('Respuesta nativa');
    expect(request).not.toHaveBeenCalled();
    expect(openai.create).toHaveBeenCalledTimes(3);
    for (const [body] of openai.create.mock.calls) expect(body).toMatchObject({ model: 'gpt-6-luna', store: false, reasoning: { effort: 'low' } });
    expect(mocks.mockGetApiKeyWithCache).not.toHaveBeenCalled();
  });

  it('un cierre durante la preparación evita continuar con investigación y acciones', async () => {
    const request = installBridge();
    const { sendMessageStream } = await import('../../services/gemini-chat');
    const result = await sendMessageStream('Investiga datos recientes sobre Claude', [], {
      onToolCall: event => {
        if (event.name !== 'web_research') return;
        const [onAuth] = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0];
        void onAuth('SIGNED_OUT', null);
      },
    });
    expect(await collectStreamText(result.stream)).toContain('Detenido');
    expect(request).not.toHaveBeenCalled();
    expect(mocks.mockGetApiKeyWithCache).not.toHaveBeenCalled();
  });

  it('un runtime Electron con puente ausente falla antes de leer claves', async () => {
    Reflect.set(window, 'ipcRenderer', {});
    await expect(withGeminiConversation(setup, undefined, async () => '')).rejects.toThrow('puente nativo');
    expect(mocks.mockGetApiKeyWithCache).not.toHaveBeenCalled();
  });

  it('Stop mientras abre cierra el identificador tardío sin enviar mensajes', async () => {
    const request = installBridge();
    let admit!: (value: { success: true; turnId: string }) => void;
    request.mockImplementationOnce(() => new Promise(resolve => { admit = resolve; }));
    const controller = new AbortController();
    const work = vi.fn(async () => 'resultado');
    const pending = withGeminiConversation(setup, controller.signal, work);
    const stopped = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await stopped;
    admit({ success: true, turnId: id });
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith({ operation: 'close', turnId: id }));
    expect(work).not.toHaveBeenCalled();
  });
});
