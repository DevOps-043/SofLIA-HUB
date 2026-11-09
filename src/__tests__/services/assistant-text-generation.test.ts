import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAssistantText } from '../../services/openai-chat/generate-text';

const mocks = vi.hoisted(() => ({ open: vi.fn(), create: vi.fn() }));
vi.mock('../../services/openai-chat/client', () => ({ getOpenAI: mocks.open }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe('Texto auxiliar con OpenAI', () => {
  it('envía únicamente el prompt y conserva el presupuesto sin herramientas ni almacenamiento', async () => {
    mocks.open.mockResolvedValue({ responses: { create: mocks.create } });
    mocks.create.mockResolvedValue({ output_text: 'Propuesta' });
    await expect(generateAssistantText({ prompt: 'Texto no confiable', maxOutputTokens: 512 })).resolves.toBe('Propuesta');
    expect(mocks.create).toHaveBeenCalledWith({
      model: 'gpt-6-luna', input: 'Texto no confiable', max_output_tokens: 512,
      reasoning: { effort: 'low' }, store: false,
    }, { signal: expect.any(AbortSignal), maxRetries: 0 });
  });

  it('el límite aborta una llamada activa y descarta su respuesta tardía', async () => {
    vi.useFakeTimers();
    mocks.open.mockResolvedValue({ responses: { create: mocks.create } });
    let resolve!: (response: { output_text: string }) => void;
    mocks.create.mockImplementation(() => new Promise(done => { resolve = done; }));
    const pending = generateAssistantText({ prompt: 'Prueba', timeout: { label: 'Prueba', ms: 10 } });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    expect(mocks.create.mock.calls[0][1].signal.aborted).toBe(true);
    resolve({ output_text: 'Tardía' });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('si vence al abrir el puente, no inicia inferencia cuando abre tarde', async () => {
    vi.useFakeTimers();
    let resolve!: (client: { responses: { create: typeof mocks.create } }) => void;
    mocks.open.mockImplementation(() => new Promise(done => { resolve = done; }));
    const pending = generateAssistantText({ prompt: 'Prueba', timeout: { label: 'Prueba', ms: 10 } });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(10);
    await rejected;
    resolve({ responses: { create: mocks.create } });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('propaga un rechazo nativo y retira el temporizador', async () => {
    vi.useFakeTimers();
    mocks.open.mockRejectedValue(new Error('Puente no disponible'));
    await expect(generateAssistantText({ prompt: 'Prueba' })).rejects.toThrow('Puente no disponible');
    expect(mocks.create).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
