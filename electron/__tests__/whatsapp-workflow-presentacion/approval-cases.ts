import { expect, it, vi } from 'vitest';
import { mockFetch, mockGenerateContent, mockSendText } from './setup';
import type { PresentationWorkflowTestContext } from './types';

function setWorkflowData(workflow: any) {
  workflow.data = {
    clientCompanyName: 'TechCorp',
    clientEmail: 'test@techcorp.com',
    proposalContent: 'Resumen de prueba',
  };
}

export function registerPresentationApprovalTests(ctx: PresentationWorkflowTestContext) {
  it('WA-154: HITL approval moves to GENERATING_PRESENTATION', async () => {
    const workflow = ctx.getWorkflow() as any;
    workflow.state = 'AWAITING_APPROVAL';
    setWorkflowData(workflow);
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gen-123' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', gammaUrl: 'https://gamma.app/xyz' }) });
    mockGenerateContent.mockResolvedValue({ response: { text: () => '# Slide 1\n## Introduccion' } });

    expect(await ctx.getWorkflow().handleInput('si')).toBe(true);
    expect(workflow.state).toBe('GENERATING_PRESENTATION');
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Aprobado'));
  });

  it('WA-155: rejection with cancelar finalizes workflow', async () => {
    (ctx.getWorkflow() as any).state = 'AWAITING_APPROVAL';
    expect(await ctx.getWorkflow().handleInput('no, cancelar')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('cancelado'));
  });

  it('WA-156: finishPresentation moves to COMPLETED without Gamma key', async () => {
    const workflow = ctx.getWorkflow() as any;
    workflow.state = 'GENERATING_PRESENTATION';
    workflow.data = {
      clientCompanyName: 'MiEmpresa',
      clientEmail: 'info@miempresa.com',
      proposalContent: 'Propuesta de valor',
    };
    mockGenerateContent.mockResolvedValue({ response: { text: () => '# Contenido de diapositiva formateado' } });
    delete process.env.VITE_GAMMA_API_KEY;
    delete process.env.GAMMA_API_KEY;

    await workflow.finishPresentation();
    expect(workflow.state).toBe('COMPLETED');
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Flujo Completado'));
  });

  it('WA-160: finishPresentation invokes Gamma API when key exists', async () => {
    vi.useFakeTimers();
    process.env.VITE_GAMMA_API_KEY = 'test-gamma-key';
    const workflow = ctx.getWorkflow() as any;
    workflow.state = 'GENERATING_PRESENTATION';
    workflow.data = { clientCompanyName: 'TestCo', clientEmail: 'test@testco.com', proposalContent: 'Propuesta' };
    mockGenerateContent.mockResolvedValue({ response: { text: () => '# Contenido formateado' } });
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gamma-gen-456' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', gammaUrl: 'https://gamma.app/result' }) });

    const completion = workflow.finishPresentation();
    await vi.advanceTimersByTimeAsync(5000);
    await completion;
    expect(mockFetch).toHaveBeenCalledWith(
      'https://public-api.gamma.app/v1.0/generations',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-API-KEY': 'test-gamma-key' }) }),
    );
    expect(workflow.state).toBe('COMPLETED');
    delete process.env.VITE_GAMMA_API_KEY;
  });
}
