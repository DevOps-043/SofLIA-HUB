import { describe, expect, it, vi } from 'vitest';
import { CONFIRM_TOOLS_WA, executeWhatsAppTools, fc, makeCtx } from './fixture';

describe('Confirmation flow', () => {
  it('WA-101: confirmation-required tool calls requestConfirmation', async () => {
    const requestConfirmation = vi.fn(async () => true);
    await executeWhatsAppTools([fc('delete_item', { path: '/tmp/test.txt' })], makeCtx({ requestConfirmation }), 'jid', '5511111', false);
    expect(requestConfirmation).toHaveBeenCalledWith('jid', '5511111', 'delete_item', expect.any(String), expect.objectContaining({ path: '/tmp/test.txt' }));
  });

  it('WA-102: denied confirmation blocks execution', async () => {
    const result = await executeWhatsAppTools([fc('delete_item', { path: '/tmp/test.txt' })], makeCtx({ requestConfirmation: vi.fn(async () => false) }), 'jid', '5511111', false);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('cancelada');
  });

  it('WA-103: accepted confirmation proceeds with execution', async () => {
    const result = await executeWhatsAppTools([fc('gmail_send', { to: 'a@b.com', subject: 'Hi', body: 'Hello' })], makeCtx({ requestConfirmation: vi.fn(async () => true) }), 'jid', '5511111', false);
    expect(result.responses[0].functionResponse.name).toBe('gmail_send');
  });

  it('WA-104: non-confirmation tools skip requestConfirmation', async () => {
    const requestConfirmation = vi.fn(async () => true);
    expect(CONFIRM_TOOLS_WA.has('read_file')).toBe(false);
    await executeWhatsAppTools([fc('iris_get_teams', {})], makeCtx({ requestConfirmation }), 'jid', '5511111', false);
    expect(requestConfirmation).not.toHaveBeenCalled();
  });

  it('WA-109: passive execution skips confirmation for confirmation-required tools', async () => {
    const { executeGoogleTool } = await import('../../whatsapp-executors/google-executors');
    const requestConfirmation = vi.fn(async () => true);
    const result = await executeWhatsAppTools([fc('gmail_send', { to: 'a@b.com', subject: 'Hi', body: 'Hello' })], makeCtx({ requestConfirmation, skipConfirmations: true }), 'jid', '5511111', false);
    expect(requestConfirmation).not.toHaveBeenCalled();
    expect(executeGoogleTool).toHaveBeenCalled();
    expect(result.responses[0].functionResponse.name).toBe('gmail_send');
  });
});
