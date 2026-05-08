import { describe, expect, it } from 'vitest';
import { executeWhatsAppTools, fc, makeCtx } from './fixture';

describe('Path-blocking integration via executeWhatsAppTools', () => {
  it('WA-107: blocks read_file targeting electron/ source', async () => {
    const result = await executeWhatsAppTools([fc('read_file', { path: 'electron/main.ts' })], makeCtx(), 'jid', '5511111', false);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('denegado');
  });

  it('WA-108: blocks read_file targeting .env', async () => {
    const result = await executeWhatsAppTools([fc('read_file', { path: '.env' })], makeCtx(), 'jid', '5511111', false);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('denegado');
  });
});
