import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeToolsAndTrackEvidence } from '../wa-agent/agent-loop-tool-execution';
import { executeWhatsAppTools } from '../whatsapp-tool-executor';
import { toolFingerprint } from '../wa-agent/tool-fingerprint';
import { handleRepeatedFailure } from '../wa-agent/agent-loop-tool-guards';
import { guardRepeatedToolSignature, isPollLikeNoProgress } from '../wa-agent/agent-loop-signature-guard';
import type { AgentLoopState } from '../wa-agent/agent-loop-types';

vi.mock('../whatsapp-tool-executor', () => ({ executeWhatsAppTools: vi.fn() }));
vi.mock('../whatsapp-prompts', () => ({ formatForWhatsApp: (text: string) => text }));
const log = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../utils/logger', () => ({ createLogger: () => log }));
const secret = 'privado-ficticio-en-argumentos-y-error';
function setup() {
  const record = vi.fn<(...args: unknown[]) => unknown>(() => undefined), sendMessage = vi.fn(async () => ({}));
  const state = { agent: { waService: { recordHistory: record, getStatus: () => ({}) } }, senderNumber: 'ficticio', jid: 'jid', isGroup: false,
    options: {}, chatSession: { sendMessage }, toolLoopTrace: [], loopGuardInterventions: 0,
    evidence: { local: false, visual: false, remote: false }, requirements: { local: false, visual: false, remote: false },
  } as unknown as AgentLoopState;
  const calls = [{ functionCall: { name: 'gmail_modify_labels', args: { contenido: secret } } }];
  const signature = toolFingerprint(state, calls);
  const run = () => executeToolsAndTrackEvidence(state, calls, signature, ['gmail_modify_labels']);
  return { state, record, sendMessage, signature, run };
}
beforeEach(() => { vi.clearAllMocks(); });
describe('Historial, trace y resultados del loop', () => {
  it('guarda observación segura y huellas, conservando el resultado original para el modelo', async () => {
    const fx = setup(); const result = { success: false, partial: true, processed: 100, uncertain: true, error: secret, message: secret };
    vi.mocked(executeWhatsAppTools).mockResolvedValueOnce({ responses: [{ functionResponse: { name: 'gmail_modify_labels', response: result } }] });
    const observed = await fx.run();
    expect(observed.functionResponses.responses[0].functionResponse.response).toBe(result);
    expect(observed.responseSummary[0]).toMatchObject({ success: false, hasError: true, processed: 100, partial: true, uncertain: true });
    expect(JSON.stringify(fx.record.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(fx.state.toolLoopTrace)).not.toContain(secret);
    expect(fx.state.toolLoopTrace[0]).toMatchObject({ toolSignature: fx.signature, hadFailure: true, responseSignature: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(fx.record.mock.calls[0][0]).toMatchObject({ metadata: { correlationId: expect.stringMatching(/^[a-f0-9-]{36}$/), durationMs: expect.any(Number) } });
    expect(JSON.stringify(fx.record.mock.calls)).not.toContain(fx.signature);
  });
  it.each(['síncrono', 'asíncrono'])('fallar recordHistory %s no pierde avance ni vuelve a ejecutar', async kind => {
    const fx = setup();
    if (kind === 'síncrono') fx.record.mockImplementationOnce(() => { throw new Error(secret); });
    else fx.record.mockRejectedValueOnce(new Error(secret));
    const payload = { success: true, effectsConfirmed: 1, processed: 100 };
    vi.mocked(executeWhatsAppTools).mockResolvedValueOnce({ responses: [{ functionResponse: { name: 'gmail_modify_labels', response: payload } }] });
    const observed = await fx.run();
    expect(observed.functionResponses.responses[0].functionResponse.response).toBe(payload);
    expect(fx.state.toolLoopTrace).toHaveLength(1); expect(executeWhatsAppTools).toHaveBeenCalledOnce();
    expect(log.warn).toHaveBeenCalledOnce(); expect(JSON.stringify(log.warn.mock.calls)).not.toContain(secret);
  });
  it('una respuesta con error presente se marca fallida sin copiar el texto', async () => {
    const fx = setup(); vi.mocked(executeWhatsAppTools).mockResolvedValueOnce({ responses: [{ functionResponse: { name: 'consulta', response: { error: secret } } }] });
    const result = await fx.run(); expect(fx.state.toolLoopTrace[0].hadFailure).toBe(true);
    expect(JSON.stringify(result.responseSummary)).not.toContain(secret);
  });
  it('una nueva confirmación parcial modifica firma y no dispara polling sin cambios', async () => {
    const fx = setup();
    for (let index = 1; index <= 3; index++) {
      vi.mocked(executeWhatsAppTools).mockResolvedValueOnce({ responses: [{ functionResponse: { name: 'poll_process_session', response: { success: true, processed: index, partial: true } } }] });
      const result = await fx.run();
      expect(isPollLikeNoProgress(fx.state, fx.signature, result.responseSignature, ['poll_process_session'])).toBe(false);
    }
    expect(new Set(fx.state.toolLoopTrace.map(entry => entry.responseSignature)).size).toBe(3);
  });
  it('huellas idénticas mantienen la guarda de repetición', async () => {
    const fx = setup(); const signature = fx.signature;
    fx.state.toolLoopTrace = Array.from({ length: 2 }, (_, index) => ({ iteration: index + 1, toolSignature: signature, responseSignature: 'ficticio', toolNames: ['consulta'], hadFailure: false }));
    expect(await guardRepeatedToolSignature(fx.state, ['consulta'], signature)).toMatchObject({ status: 'retry' });
  });
  it('el cierre por fallos repetidos no incorpora el error privado a la respuesta', async () => {
    const fx = setup(); fx.state.loopGuardInterventions = 1;
    const result = await handleRepeatedFailure(fx.state, ['consulta'], 3);
    expect(result).toMatchObject({ done: true }); expect(JSON.stringify(result)).not.toContain(secret);
  });
});
