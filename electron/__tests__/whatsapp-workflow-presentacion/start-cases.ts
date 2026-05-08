import { expect, it, vi } from 'vitest';
import { mockGenerateContent, mockSendText } from './setup';
import type { PresentationWorkflowTestContext } from './types';

export function registerPresentationStartTests(ctx: PresentationWorkflowTestContext) {
  it('WA-151: starts in AWAITING_DATA', async () => {
    await ctx.getWorkflow().start();
    expect(mockSendText).toHaveBeenCalledWith(
      '5551234567@s.whatsapp.net',
      expect.stringContaining('presentaci'),
    );
    expect((ctx.getWorkflow() as any).state).toBe('AWAITING_DATA');
  });

  it('WA-152: moves to PROCESSING_PROPOSAL after extracting company and email', async () => {
    await ctx.getWorkflow().start();
    const handled = await ctx.getWorkflow().handleInput('Empresa TechCorp y mi correo es test@techcorp.com');
    expect(handled).toBe(true);
    expect((ctx.getWorkflow() as any).state).toBe('PROCESSING_PROPOSAL');
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('TechCorp'));
  });

  it('WA-153: moves to AWAITING_APPROVAL after proposal generation', async () => {
    await ctx.getWorkflow().start();
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => '{"company": "Acme", "email": "info@acme.com"}' } })
      .mockResolvedValueOnce({ response: { text: () => 'Acme es una empresa de tecnologia.' } })
      .mockResolvedValueOnce({ response: { text: () => '1. Automatizacion\n2. IA\n3. Integraciones' } });

    await ctx.getWorkflow().handleInput('Empresa Acme correo info@acme.com');

    await vi.waitFor(() => {
      expect((ctx.getWorkflow() as any).state).toBe('AWAITING_APPROVAL');
    }, { timeout: 2000 });
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Resumen Ejecutivo'));
  });
}
