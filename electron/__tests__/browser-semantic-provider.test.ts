import { beforeEach, describe, expect, it, vi } from 'vitest';
import { embedSessionTexts } from '../ai-provider/embeddings';
const mocks = vi.hoisted(() => ({ create: vi.fn(), client: vi.fn() }));
vi.mock('../ai-provider/session-client', () => ({ getSessionOpenAIClient: mocks.client }));
const vector = Array.from({ length: 768 }, (_, index) => index === 0 ? 1 : 0);
beforeEach(() => { vi.resetAllMocks(); mocks.client.mockResolvedValue({ embeddings: { create: mocks.create } }); });
describe('Embeddings nativos OpenAI', () => {
  it('conserva dimensiones y reordena resultados por índice', async () => {
    const signal = new AbortController().signal;
    mocks.create.mockResolvedValue({ data: [{ index: 1, embedding: vector.map(x => -x) }, { index: 0, embedding: vector }] });
    const result = await embedSessionTexts(['consulta', 'fuente'], 768, signal);
    expect(result.map(row => row[0])).toEqual([1, -1]);
    expect(mocks.create).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: ['consulta', 'fuente'], dimensions: 768, encoding_format: 'float' }, { signal });
  });
  it('rechaza un lote incompleto y descarta respuestas revocadas', async () => {
    const controller = new AbortController();
    mocks.create.mockResolvedValueOnce({ data: [] });
    await expect(embedSessionTexts(['fuente'], 768, controller.signal)).rejects.toThrow('Vectores');
    mocks.create.mockImplementationOnce(async () => { controller.abort(); return { data: [{ index: 0, embedding: vector }] }; });
    await expect(embedSessionTexts(['fuente'], 768, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
