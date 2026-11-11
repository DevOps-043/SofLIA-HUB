import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { MeetingContextPackLoader, type MeetingContextPack } from '../meetings/meeting-context-pack';
import { tryExtractMeetingWithAI } from '../meetings/meeting-ai/extraction-runtime';
import type { ExtractMeetingAssetInput } from '../meetings/meeting-ai/internal-types';

const mocks = vi.hoisted(() => ({ client: vi.fn(), fetch: vi.fn<typeof globalThis.fetch>() }));
vi.mock('../ai-provider/session-client', () => ({ getSessionOpenAIClient: mocks.client }));
let pack: MeetingContextPack;
const input: ExtractMeetingAssetInput = {
  traceId: 'traza-ficticia', meetingRunId: 'reunion-ficticia', meetingTitle: 'Plan de trabajo', meetingType: 'general',
  sourceArtifact: {
    id: 'fuente-ficticia', meeting_run_id: 'reunion-ficticia', source_system: 'manual', source_type: 'text',
    source_uri: null, external_file_id: null, mime_type: 'text/plain', authority_level: 'user_provided',
    sha256: 'a'.repeat(64), normalized_text: 'Se acordó revisar el borrador el lunes.', metadata: {}, created_at: '2026-11-07T00:00:00Z',
  },
};
function response(text: string) {
  return new Response(JSON.stringify({ id: 'resp_ficticia', object: 'response', output: [
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] },
  ] }), { headers: { 'content-type': 'application/json' } });
}
beforeAll(async () => { pack = await new MeetingContextPackLoader().load(); });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue(new OpenAI({ apiKey: 'credencial-ficticia', fetch: mocks.fetch, maxRetries: 0 }));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Clasificación y extracción de reuniones con Responses', () => {
  it('clasifica antes de extraer y conserva evidencia y aprobación en los prompts', async () => {
    mocks.fetch.mockResolvedValueOnce(response(JSON.stringify({ suggestedType: 'fallback_general_operational', confidence: 0.8, reason: 'Evidencia del turno' })))
      .mockResolvedValueOnce(response(JSON.stringify({ executiveSummary: 'Revisar el borrador', tasks: [] })));
    const result = await tryExtractMeetingWithAI({ input, contextPack: pack });
    expect(result).toMatchObject({ executiveSummary: 'Revisar el borrador', meetingType: { suggestedType: 'fallback_general_operational', confidence: 0.8 } });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    const requests = mocks.fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    for (const body of requests) {
      expect(body).toMatchObject({ model: 'gpt-6-luna', store: false, text: { format: { type: 'json_object' } }, reasoning: { effort: 'low' } });
      expect(body.input).toContain(input.sourceArtifact.normalized_text);
      expect(body).not.toHaveProperty('tools');
    }
    expect(requests[0].max_output_tokens).toBe(2048);
    expect(requests[1].max_output_tokens).toBe(8192);
    expect(requests[1].input).toContain('requiresHumanApproval: true');
  });

  it('sin credencial conserva el fallback local sin iniciar transporte', async () => {
    mocks.client.mockRejectedValue(new Error('Detalle privado'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await tryExtractMeetingWithAI({ input, contextPack: pack })).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Detalle privado');
  });

  it('un JSON de clasificación inválido no inicia extracción', async () => {
    mocks.fetch.mockResolvedValueOnce(response('JSON inválido'));
    expect(await tryExtractMeetingWithAI({ input, contextPack: pack })).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('un fallo al extraer conserva fallback sin registrar el cuerpo del proveedor', async () => {
    mocks.fetch.mockResolvedValueOnce(response('{"confidence":0.1}')).mockResolvedValueOnce(response('Respuesta privada inválida'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await tryExtractMeetingWithAI({ input, contextPack: pack })).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Respuesta privada');
  });
});
