import { describe, expect, it, vi } from 'vitest';

const dispatch = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('../../services/gemini-chat/tool-dispatch', () => ({
  isKnownGeminiTool: () => true, executeGeminiToolCall: dispatch.execute,
}));
import { runAgenticLoop } from '../../services/gemini-chat/agentic-loop';
import { collectStreamText } from '../../services/gemini-chat/streams';
import { withToolTimeout } from '../../services/gemini-chat/resilience';

describe('cierre de Gemini en el límite', () => {
  it('timeout cancela el permiso antes de que una aprobación tardía pueda ejecutar', async () => {
    let childSignal: AbortSignal | undefined;
    await expect(withToolTimeout('espera de permiso', async signal => {
      childSignal = signal;
      return await new Promise(resolve => signal.addEventListener('abort', () => resolve(false), { once: true }));
    }, 10)).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(childSignal?.aborted).toBe(true);
  });
  it.each([false, true])('procesa cierre y rechaza herramientas adicionales: %s', async insists => {
    dispatch.execute.mockReset();
    dispatch.execute.mockResolvedValue({ functionResponse: { name: 'list_directory_summary', response: { success: true } } });
    const call = { candidates: [{ content: { parts: [{ functionCall: { name: 'list_directory_summary', args: {} } }] } }] };
    const sendMessage = vi.fn();
    for (let index = 0; index < 10; index++) sendMessage.mockResolvedValueOnce(call);
    sendMessage.mockResolvedValueOnce(insists ? call : { candidates: [{ content: { parts: [{ text: 'Sólo se analizaron las carpetas; falta mover los documentos.' }] } }] });
    const result = await runAgenticLoop({ chatSession: { sendMessage }, chatConfig: {} as never, messageContent: 'organiza', allToolCalls: [], allGeneratedImages: [] });
    expect(sendMessage).toHaveBeenCalledTimes(11);
    expect(dispatch.execute).toHaveBeenCalledTimes(10);
    expect(sendMessage.mock.calls[10][0].config.tools).toEqual([]);
    expect(JSON.stringify(sendMessage.mock.calls[10][0].message)).toContain('SIN herramientas');
    await expect(collectStreamText(result.stream)).resolves.toContain(insists ? 'No pude completar' : 'falta mover');
  });
});
