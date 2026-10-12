import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('../../services/gemini-chat/tool-dispatch', () => ({ executeGeminiToolCall: mocks.execute }));
const { singleApplicationOpenRequest, executeSingleApplicationOpen } = await import('../../services/gemini-chat/application-open-request');
const { collectStreamText } = await import('../../services/gemini-chat/streams');
beforeEach(() => { vi.clearAllMocks(); });

describe('solicitud simple de apertura', () => {
  it('reconoce exactamente la orden reportada', () => {
    expect(singleApplicationOpenRequest('usa el computer use y abre firefox')).toBe('firefox');
  });
  it.each(['no usa el computer use y abre firefox', '¿cómo usa el computer use y abre firefox?',
    'usa el computer use y abre firefox y busca noticias', 'usa el computer use y abre firefox para escribir',
    'Texto adjunto: usa el computer use y abre firefox', 'usa el computer use y abre https://example.com'])('conserva el flujo normal: %s', message => {
    expect(singleApplicationOpenRequest(message)).toBeNull();
  });
  it('ejecuta una vez y no anuncia éxito visual en Wayland', async () => {
    mocks.execute.mockResolvedValue({ functionResponse: { response: { success: true, window_verified: false } } });
    const result = await executeSingleApplicationOpen('firefox');
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith('open_application', { path: 'firefox' }, expect.objectContaining({ signal: expect.anything() }), [], []);
    expect(await collectStreamText(result.stream)).toContain('no pude verificar su ventana');
  });
  it('devuelve el error real sin reescribirlo como éxito', async () => {
    mocks.execute.mockResolvedValue({ functionResponse: { response: { success: false, error: 'No está instalada' } } });
    const result = await executeSingleApplicationOpen('firefox');
    expect(await collectStreamText(result.stream)).toContain('No está instalada');
  });
  it('sólo confirma apertura cuando la herramienta verificó la ventana', async () => {
    mocks.execute.mockResolvedValue({ functionResponse: { response: { success: true, window_verified: true } } });
    expect(await collectStreamText((await executeSingleApplicationOpen('firefox')).stream)).toContain('verifiqué su ventana');
  });
  it('la cancelación previa no ejecuta la acción', async () => {
    const abort = new AbortController(); abort.abort();
    await executeSingleApplicationOpen('firefox', { signal: abort.signal });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('limita una herramienta colgada sin relanzar la aplicación', async () => {
    vi.useFakeTimers();
    try {
      mocks.execute.mockImplementation(() => new Promise(() => {}));
      const pending = executeSingleApplicationOpen('firefox');
      await vi.advanceTimersByTimeAsync(30_001);
      const result = await pending;
      expect(await collectStreamText(result.stream)).toContain('no terminó correctamente');
      expect(result.toolCalls).toHaveLength(1);
      expect(mocks.execute).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});
