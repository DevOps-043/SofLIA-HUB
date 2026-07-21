import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeWhatsAppTools, fc, makeCtx } from './fixture';

const { dynamicToolService } = await import('../../dynamic-tool-service');
const hasTool = vi.mocked(dynamicToolService.hasTool);
const getRuntimeDescriptor = vi.mocked(dynamicToolService.getRuntimeDescriptor);
const executeTool = vi.mocked(dynamicToolService.executeTool);

const readPolicy = {
  owner: 'integrations-platform',
  risk: 'read' as const,
  allowedAgents: ['whatsapp-agent' as const],
  hitl: 'never' as const,
  allowInGroups: false,
  timeoutMs: 1_000,
  audit: true as const,
};

const writePolicy = {
  ...readPolicy,
  risk: 'write' as const,
  hitl: 'required' as const,
};

const fingerprint = 'a'.repeat(64);

describe('Dynamic tool runtime policies in WhatsApp', () => {
  beforeEach(() => {
    hasTool.mockResolvedValue(false);
    getRuntimeDescriptor.mockResolvedValue(undefined);
    executeTool.mockResolvedValue({ success: true });
  });

  it('WA-115: lectura dinámica no pide HITL y recibe contexto gobernado', async () => {
    hasTool.mockResolvedValue(true);
    getRuntimeDescriptor.mockResolvedValue({ policy: readPolicy, contractFingerprint: fingerprint });
    const requestConfirmation = vi.fn(async () => true);

    const result = await executeWhatsAppTools(
      [fc('home_assistant_get_state', { entity_id: 'light.sala' })],
      makeCtx({ requestConfirmation }),
      'jid',
      '5511111',
      false,
    );

    expect(requestConfirmation).not.toHaveBeenCalled();
    expect(executeTool).toHaveBeenCalledWith(
      'home_assistant_get_state',
      { entity_id: 'light.sala' },
      expect.objectContaining({
        agentId: 'whatsapp-agent',
        channel: 'whatsapp',
        approvedByHuman: false,
        contractFingerprint: fingerprint,
        actorRef: expect.stringMatching(/^wa:[a-f0-9]{16}$/),
        traceId: expect.any(String),
      }),
    );
    expect(result.responses[0].functionResponse.response.success).toBe(true);
  });

  it('WA-116: escritura dinámica pide confirmación sin mostrar argumentos', async () => {
    hasTool.mockResolvedValue(true);
    getRuntimeDescriptor.mockResolvedValue({ policy: writePolicy, contractFingerprint: fingerprint });
    const requestConfirmation = vi.fn(async () => true);

    await executeWhatsAppTools(
      [fc('home_assistant_call_service', { domain: 'light', service: 'turn_on', data_json: '{"token":"secreto"}' })],
      makeCtx({ requestConfirmation }),
      'jid',
      '5511111',
      false,
    );

    expect(requestConfirmation).toHaveBeenCalledWith(
      'jid',
      '5511111',
      'home_assistant_call_service',
      expect.stringContaining('riesgo: write'),
      {},
    );
    const confirmationCalls = requestConfirmation.mock.calls as unknown as Array<[
      string,
      string,
      string,
      string,
      Record<string, unknown>,
    ]>;
    expect(confirmationCalls[0]?.[3]).not.toContain('secreto');
    expect(executeTool).toHaveBeenCalledWith(
      'home_assistant_call_service',
      expect.any(Object),
      expect.objectContaining({ approvedByHuman: true }),
    );
  });

  it('WA-117: skipConfirmations no salta HITL de plugins dinámicos', async () => {
    hasTool.mockResolvedValue(true);
    getRuntimeDescriptor.mockResolvedValue({ policy: writePolicy, contractFingerprint: fingerprint });
    const requestConfirmation = vi.fn(async () => false);
    executeTool.mockImplementation(async (_name, _args, context) => {
      if (!context.approvedByHuman) throw new Error('approval_required');
      return { success: true };
    });

    const result = await executeWhatsAppTools(
      [fc('home_assistant_call_service', { domain: 'light', service: 'turn_off' })],
      makeCtx({ requestConfirmation, skipConfirmations: true }),
      'jid',
      '5511111',
      false,
    );

    expect(requestConfirmation).toHaveBeenCalledOnce();
    expect(executeTool).toHaveBeenCalledWith(
      'home_assistant_call_service',
      expect.any(Object),
      expect.objectContaining({ approvedByHuman: false }),
    );
    expect(result.responses[0].functionResponse.response).toMatchObject({ success: false, error: 'approval_required' });
  });
});
