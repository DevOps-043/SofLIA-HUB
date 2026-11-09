import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ run: vi.fn(), create: vi.fn() }));
vi.mock('../../services/gemini-chat/agentic-loop', () => ({ runAgenticLoop: mocks.run }));
vi.mock('../../services/gemini-chat/client', () => ({ getGenAiClient: async () => ({ chats: { create: mocks.create } }) }));
vi.mock('../../services/gemini-chat/model-config', () => ({ buildModelTools: () => [] }));
import { runResearchActionPhase } from '../../services/gemini-chat/research-action';
import { collectStreamText, singleChunkStream } from '../../services/gemini-chat/streams';
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
const request = () => ({ grounded: { stream: singleChunkStream('Investigación verificada'), sources: Promise.resolve(null) }, originalMessage: 'Crear documento', systemInstruction: 'Prueba', history: [], generationConfig: {}, candidateModelIds: ['modelo-ficticio'], computerUseEnabled: false });
describe('Privacidad al ejecutar acciones tras investigar', () => {
  it('conserva la investigación sin registrar detalles de la excepción', async () => {
    const secret = 'clave-ficticia documento-privado'; const failure = new Error(secret); mocks.run.mockRejectedValueOnce(failure); const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runResearchActionPhase(request()); const text = await collectStreamText(result.stream);
    expect(text).toContain('Investigación verificada'); expect(text).toContain('No pude completar las acciones');
    const logged = warning.mock.calls.flatMap(args => args.map(arg => arg instanceof Error ? arg.message : JSON.stringify(arg, (_key, value: unknown) => value instanceof Error ? value.message : value))).join(' ');
    expect(warning).toHaveBeenCalledTimes(2); expect(logged).not.toContain(secret);
  });
  it('una cancelación conserva investigación sin reintentar ni registrar el error', async () => {
    const controller = new AbortController(); const warning = vi.spyOn(console, 'warn').mockImplementation(() => {}); mocks.run.mockImplementationOnce(async () => { controller.abort(); throw new Error('dato-privado'); });
    const result = await runResearchActionPhase({ ...request(), options: { signal: controller.signal } });
    expect(await collectStreamText(result.stream)).toContain('Investigación verificada'); expect(mocks.run).toHaveBeenCalledOnce(); expect(warning).not.toHaveBeenCalled();
  });
});

let originalIpc: Window['ipcRenderer'];
beforeEach(() => { originalIpc = window.ipcRenderer; Reflect.set(window, 'ipcRenderer', undefined); });
afterEach(() => { Reflect.set(window, 'ipcRenderer', originalIpc); });
