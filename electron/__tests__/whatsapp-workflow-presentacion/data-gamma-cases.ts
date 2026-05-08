import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WorkflowManager,
  createPresentationWorkflow,
  mockAgent,
  mockFetch,
  mockGenerateContent,
  mockSendText,
  mockWaService,
  resetPresentationWorkflowMocks,
} from './setup';
import type { PresentacionWorkflow } from './setup';

describe('PresentacionWorkflow data extraction and Gamma integration', () => {
  let workflow: PresentacionWorkflow;

  beforeEach(() => {
    resetPresentationWorkflowMocks();
    workflow = createPresentationWorkflow();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WA-157: extractData reads company name through Gemini', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '{"company": "DevOps Corp", "email": null}' } });
    await (workflow as any).extractData('La empresa es DevOps Corp');
    expect((workflow as any).data.clientCompanyName).toBe('DevOps Corp');
  });

  it('WA-158: extractData reads email through Gemini', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => '{"company": null, "email": "user@example.com"}' } });
    await (workflow as any).extractData('mi correo es user@example.com');
    expect((workflow as any).data.clientEmail).toBe('user@example.com');
  });

  it('WA-159: rejects extra input during GENERATING_PRESENTATION with wait message', async () => {
    (workflow as any).state = 'GENERATING_PRESENTATION';
    const handled = await workflow.handleInput('apurate');
    expect(handled).toBe(true);
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Terminando de generar'));
  });

  it('WA-160: finishPresentation invokes Gamma API when key is available', async () => {
    vi.useFakeTimers();
    process.env.VITE_GAMMA_API_KEY = 'test-gamma-key';
    (workflow as any).state = 'GENERATING_PRESENTATION';
    (workflow as any).data = { clientCompanyName: 'TestCo', clientEmail: 'test@testco.com', proposalContent: 'Propuesta de prueba' };
    mockGenerateContent.mockResolvedValue({ response: { text: () => '# Contenido formateado' } });
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gamma-gen-456' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', gammaUrl: 'https://gamma.app/result' }) });

    const completion = (workflow as any).finishPresentation();
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    await completion;

    expect(mockFetch).toHaveBeenCalledWith('https://public-api.gamma.app/v1.0/generations', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-API-KEY': 'test-gamma-key' }),
    }));
    expect((workflow as any).state).toBe('COMPLETED');
  });

  it('WA-161: allows natural-language cancellation from AWAITING_DATA', async () => {
    const extractSpy = vi.spyOn(workflow as any, 'extractData');
    const handled = await workflow.handleInput('Cancela el flujo');
    expect(handled).toBe(false);
    expect(extractSpy).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('cancelado'));
  });

  it('WA-162: cancels the flow after 5 minutes of inactivity', async () => {
    vi.useFakeTimers();
    await WorkflowManager.startWorkflow('mgr-timeout', '5551234567@s.whatsapp.net', '5551234567', mockWaService as any, mockAgent as any);

    expect(WorkflowManager.isActive('mgr-timeout')).toBe(true);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(WorkflowManager.isActive('mgr-timeout')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith('5551234567@s.whatsapp.net', expect.stringContaining('inactividad'));
  });
});
