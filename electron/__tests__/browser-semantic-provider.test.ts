import { beforeEach, describe, expect, it, vi } from 'vitest';
import { googleSemanticEmbedder } from '../integrated-browser/semantic-memory';
const mocks = vi.hoisted(() => ({ embedContent: vi.fn(), constructed: vi.fn() }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class {
  models = { embedContent: mocks.embedContent };
  constructor(options: unknown) { mocks.constructed(options); }
} }));
const values = Array.from({ length: 768 }, (_, index) => index === 0 ? 2 : 0);
beforeEach(() => { vi.clearAllMocks(); mocks.embedContent.mockResolvedValue({ embeddings: [{ values }] }); });
describe('proveedor semántico cerrado', () => {
  it('configura dimensiones, modalidad y cancelación sin retornar la clave', async () => {
    const signal = new AbortController().signal; const embed = googleSemanticEmbedder(() => 'clave-ficticia');
    const result = await embed(['consulta'], true, signal);
    expect(mocks.constructed).toHaveBeenCalledWith({ apiKey: 'clave-ficticia' });
    expect(mocks.embedContent).toHaveBeenCalledWith({ model: 'gemini-embedding-001', contents: ['consulta'], config: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY', abortSignal: signal, httpOptions: { timeout: 30000 } } });
    expect(result[0][0]).toBe(1); expect(JSON.stringify(result)).not.toContain('clave');
    await embed(['documento'], false, signal);
    expect(mocks.embedContent.mock.calls[1][0].config.taskType).toBe('RETRIEVAL_DOCUMENT');
  });
  it('rechaza clave ausente y respuesta parcial antes de publicar índice', async () => {
    const signal = new AbortController().signal;
    await expect(googleSemanticEmbedder(() => null)(['consulta'], true, signal)).rejects.toThrow('Configura');
    expect(mocks.constructed).not.toHaveBeenCalled();
    mocks.embedContent.mockResolvedValueOnce({ embeddings: [] });
    await expect(googleSemanticEmbedder(() => 'ficticia')(['documento'], false, signal)).rejects.toThrow('incompleta');
  });
});
