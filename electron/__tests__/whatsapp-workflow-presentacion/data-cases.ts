import { expect, it, vi } from 'vitest';
import { mockGenerateContent, mockSendText } from './setup';
import type { PresentationWorkflowTestContext } from './types';

export function registerPresentationDataTests(ctx: PresentationWorkflowTestContext) {
  it('WA-157: extractData extracts company name via Gemini', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"company": "DevOps Corp", "email": null}' },
    });
    await (ctx.getWorkflow() as any).extractData('La empresa es DevOps Corp');
    expect((ctx.getWorkflow() as any).data.clientCompanyName).toBe('DevOps Corp');
  });

  it('WA-158: extractData extracts email via Gemini', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"company": null, "email": "user@example.com"}' },
    });
    await (ctx.getWorkflow() as any).extractData('mi correo es user@example.com');
    expect((ctx.getWorkflow() as any).data.clientEmail).toBe('user@example.com');
  });

  it('WA-159: rejects extra input while GENERATING_PRESENTATION', async () => {
    (ctx.getWorkflow() as any).state = 'GENERATING_PRESENTATION';
    expect(await ctx.getWorkflow().handleInput('apÃºrate')).toBe(true);
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Terminando de generar'));
  });

  it('WA-161: cancels from AWAITING_DATA with natural language', async () => {
    const extractSpy = vi.spyOn(ctx.getWorkflow() as any, 'extractData');
    expect(await ctx.getWorkflow().handleInput('Cancela el flujo')).toBe(false);
    expect(extractSpy).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('cancelado'));
  });

  it('WA-162: cancels workflow after 5 minutes of inactivity', async () => {
    vi.useFakeTimers();
    await ctx.WorkflowManager.startWorkflow(
      'mgr-timeout',
      '5551234567@s.whatsapp.net',
      '5551234567',
      { sendText: mockSendText, isConnected: vi.fn().mockReturnValue(true) } as any,
      { getGenAI: vi.fn().mockReturnValue({ getGenerativeModel: vi.fn() }) } as any,
    );

    expect(ctx.WorkflowManager.isActive('mgr-timeout')).toBe(true);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(ctx.WorkflowManager.isActive('mgr-timeout')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith('5551234567@s.whatsapp.net', expect.stringContaining('inactividad'));
  });
}
