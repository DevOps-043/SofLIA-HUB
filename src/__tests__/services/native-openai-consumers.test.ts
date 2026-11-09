import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpenAIRuntimeApi } from '../../shared/openai-runtime';
import { sendOpenAIMessageStream } from '../../services/openai-chat/send-message-stream';
import { prepareChatTeam } from '../../services/gemini-chat/agent-team';
const ports = vi.hoisted(() => ({ execute: vi.fn(), tokens: vi.fn() }));
vi.mock('../../services/gemini-chat/tool-dispatch', () => ({ isKnownGeminiTool: () => true, executeGeminiToolCall: ports.execute }));
vi.mock('../../services/model-quota', () => ({ SOFLIA_MAX_MODEL_ID: 'gpt-6.1-sol', recordSofliaMaxTokens: ports.tokens }));
afterEach(() => { Reflect.deleteProperty(window, 'openaiRuntime'); Reflect.deleteProperty(window, 'flowInference'); vi.clearAllMocks(); });
function fixture() {
  let current = 0; const runs = new Map<string, number>();
  const api = { open: vi.fn<OpenAIRuntimeApi['open']>(async () => ({ success: true, scopeId: 'ficticio' })), start: vi.fn<OpenAIRuntimeApi['start']>(async (_scope, id) => { runs.set(id, current++); return { success: true, requestId: id }; }), pull: vi.fn<OpenAIRuntimeApi['pull']>(), cancel: vi.fn<OpenAIRuntimeApi['cancel']>(async () => ({ success: true, cancelled: true })) };
  Object.defineProperty(window, 'openaiRuntime', { value: api, configurable: true }); return { api, runs };
}
describe('Consumidores reales del puerto OpenAI nativo', () => {
  it('transcribe audio por el puente nativo y no incrusta sus bytes en Responses', async () => {
    const { api } = fixture();
    api.pull.mockImplementation(async (_scope, _id, cursor) => ({ success: true, kind: 'done', cursor: cursor + 1 }));
    const generate = vi.fn(async () => ({ success: true as const, text: '{"transcript":"Dato escuchado"}' }));
    window.flowInference = { generate };
    const onMediaEnvelope = vi.fn();
    const result = await sendOpenAIMessageStream({ modelId: 'gpt-6-luna', finalMessage: 'Resume el audio', systemInstruction: 'Prueba', conversationHistory: [], useToolLoop: false, computerUseEnabled: false, useWebSearch: false,
      options: { onMediaEnvelope, media: [{ kind: 'inline', mimeType: 'audio/mp3', base64: 'cHJ1ZWJh' }] },
    });
    let visible = '';
    for await (const chunk of result.stream) visible += chunk;
    expect(visible).toBeTruthy();
    expect(generate).toHaveBeenCalledWith({ kind: 'transcription', mimeType: 'audio/mp3', audio: 'cHJ1ZWJh' });
    const input = JSON.stringify(api.start.mock.calls[0][2].input);
    expect(input).toContain('Dato escuchado');
    expect(input).not.toContain('cHJ1ZWJh');
    expect(onMediaEnvelope).toHaveBeenCalledWith(expect.objectContaining({ sent: [{ kind: 'inline', mimeType: 'audio/mp3', transcribed: true }], rejected: [] }));
  });
  it('envía cuadros como imágenes y declara medios que aún requieren preparación', async () => {
    const { api } = fixture();
    api.pull.mockImplementation(async (_scope, _id, cursor) => ({ success: true, kind: 'done', cursor: cursor + 1 }));
    const onMediaEnvelope = vi.fn();
    const result = await sendOpenAIMessageStream({ modelId: 'gpt-6-luna', finalMessage: 'Analiza el vídeo', systemInstruction: 'Prueba', conversationHistory: [], useToolLoop: false, computerUseEnabled: false, useWebSearch: false,
      options: { onMediaEnvelope, media: [
        { kind: 'frames', frames: [{ base64: 'cHJ1ZWJh', mimeType: 'image/jpeg', atSeconds: 1 }] },
        { kind: 'remote', mimeType: 'video/mp4', uri: 'https://example.test/medio' },
      ] },
    });
    let visible = '';
    for await (const chunk of result.stream) visible += chunk;
    expect(visible).toBeTruthy();
    const input = JSON.stringify(api.start.mock.calls[0][2].input);
    expect(input).toContain('data:image/jpeg;base64,cHJ1ZWJh');
    expect(input).toContain('Evidencia omitida');
    expect(input).not.toContain('example.test/medio');
    expect(onMediaEnvelope).toHaveBeenCalledWith(expect.objectContaining({ sent: [{ kind: 'frames', frameCount: 1 }], rejected: [expect.objectContaining({ reason: 'formato-no-admitido' })] }));
  });
  it('chat conserva texto/citas/uso y esfuerzo max del selector', async () => {
    const { api } = fixture();
    api.pull.mockImplementation(async (_scope, _id, cursor) => {
      const event = cursor === 0 ? { type: 'response.output_text.delta', delta: 'Respuesta nativa' } : cursor === 1 ? { type: 'response.output_text.annotation.added', annotation: { type: 'url_citation', url: 'https://example.test/fuente', title: 'Fuente' } } : cursor === 2 ? { type: 'response.completed', response: { usage: { total_tokens: 12 } } } : null;
      return event ? { success: true, kind: 'event', cursor: cursor + 1, event: event as never } : { success: true, kind: 'done', cursor: cursor + 1 };
    });
    const result = await sendOpenAIMessageStream({ modelId: 'gpt-6.1-sol', finalMessage: 'prueba', systemInstruction: 'prueba', conversationHistory: [], useToolLoop: false, computerUseEnabled: false, useWebSearch: true, options: { userId: 'usuario', thinking: { id: 'max', level: 'max' } } });
    let text = ''; for await (const chunk of result.stream) text += chunk;
    expect(text).toBe('Respuesta nativa'); expect(await result.sources).toContainEqual({ uri: 'https://example.test/fuente', title: 'Fuente' }); expect(ports.tokens).toHaveBeenCalledWith('usuario', 12); expect(api.cancel).toHaveBeenCalledOnce();
    expect(api.start.mock.calls[0][2]).toMatchObject({ reasoning: { effort: 'max' } });
  });
  it('análisis en equipo conserva modelo/salida/uso por las dos respuestas nativas', async () => {
    const { api } = fixture(); api.pull.mockImplementation(async (_scope, _id, cursor) => ({ success: true, kind: 'response', cursor: cursor + 1, response: { output_text: 'Aporte nativo', usage: { total_tokens: 7 } } as never }));
    const result = await prepareChatTeam({ message: 'Crea una presentación con propuestas distintas', source: 'datos', modelId: 'gpt-6.1-sol', options: { teamMode: 'team', userId: 'usuario' } });
    expect(result.context).toContain('Aporte nativo'); expect(api.start).toHaveBeenCalledTimes(2); expect(api.cancel).toHaveBeenCalledTimes(2);
    for (const call of api.start.mock.calls) expect(call[2]).toMatchObject({ model: 'gpt-6.1-sol', store: false, reasoning: { effort: 'low' } });
    expect(ports.tokens).toHaveBeenCalledWith('usuario', 7);
  });
  it('chat reinyecta una herramienta real del dispatcher y continúa por otro trabajo nativo', async () => {
    const { api, runs } = fixture(); ports.execute.mockResolvedValueOnce({ functionResponse: { name: 'read_file', response: { success: true, content: 'dato autorizado' } } });
    api.pull.mockImplementation(async (_scope, id, cursor) => {
      const run = runs.get(id); const event = cursor === 0 ? run === 0 ? { type: 'response.output_item.done', item: { type: 'function_call', name: 'read_file', call_id: 'call-ficticia', arguments: '{"path":"ficticio"}' } } : { type: 'response.output_text.delta', delta: 'Lectura completada' } : null;
      return event ? { success: true, kind: 'event', cursor: cursor + 1, event: event as never } : { success: true, kind: 'done', cursor: cursor + 1 };
    });
    const result = await sendOpenAIMessageStream({ modelId: 'gpt-6-luna', finalMessage: 'lee archivo', systemInstruction: 'prueba', conversationHistory: [], useToolLoop: true, computerUseEnabled: true, useWebSearch: false });
    let text = ''; for await (const chunk of result.stream) text += chunk;
    expect(text).toBe('Lectura completada'); expect(ports.execute).toHaveBeenCalledOnce(); expect(api.start).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(api.start.mock.calls[1][2])).toContain('dato autorizado'); expect(api.cancel).toHaveBeenCalledTimes(2);
  });
});
