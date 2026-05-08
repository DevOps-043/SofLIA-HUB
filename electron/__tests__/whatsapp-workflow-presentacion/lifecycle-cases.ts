import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPresentationWorkflow,
  mockFetch,
  mockGenerateContent,
  mockSendText,
  resetPresentationWorkflowMocks,
} from './setup';
import type { PresentacionWorkflow } from './setup';

describe('PresentacionWorkflow lifecycle', () => {
  let workflow: PresentacionWorkflow;

  beforeEach(() => {
    resetPresentationWorkflowMocks();
    workflow = createPresentationWorkflow();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WA-151: starts in AWAITING_DATA', async () => {
    await workflow.start();
    expect(mockSendText).toHaveBeenCalledWith('5551234567@s.whatsapp.net', expect.stringContaining('presentaci'));
    expect((workflow as any).state).toBe('AWAITING_DATA');
  });

  it('WA-152: moves to PROCESSING_PROPOSAL when company and email are extracted', async () => {
    await workflow.start();
    const handled = await workflow.handleInput('Empresa TechCorp y mi correo es test@techcorp.com');
    expect(handled).toBe(true);
    expect((workflow as any).state).toBe('PROCESSING_PROPOSAL');
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('TechCorp'));
  });

  it('WA-153: moves to AWAITING_APPROVAL after generating the proposal', async () => {
    await workflow.start();
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => '{"company": "Acme", "email": "info@acme.com"}' } })
      .mockResolvedValueOnce({ response: { text: () => 'Acme es una empresa de tecnologia.' } })
      .mockResolvedValueOnce({ response: { text: () => '1. Automatizacion\n2. IA\n3. Integraciones' } });

    await workflow.handleInput('Empresa Acme correo info@acme.com');

    await vi.waitFor(() => {
      expect((workflow as any).state).toBe('AWAITING_APPROVAL');
    }, { timeout: 2000 });
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Resumen Ejecutivo'));
  });

  it('WA-154: approval moves to GENERATING_PRESENTATION', async () => {
    (workflow as any).state = 'AWAITING_APPROVAL';
    (workflow as any).data = {
      clientCompanyName: 'TechCorp',
      clientEmail: 'test@techcorp.com',
      proposalContent: 'Resumen de prueba',
    };
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gen-123' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', gammaUrl: 'https://gamma.app/xyz' }) });
    mockGenerateContent.mockResolvedValue({ response: { text: () => '# Slide 1\n## Introduccion' } });

    const handled = await workflow.handleInput('si');
    expect(handled).toBe(true);
    expect((workflow as any).state).toBe('GENERATING_PRESENTATION');
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Aprobado'));
  });

  it('WA-155: rejection cancels the workflow', async () => {
    (workflow as any).state = 'AWAITING_APPROVAL';
    const handled = await workflow.handleInput('no, cancelar');
    expect(handled).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('cancelado'));
  });

  it('WA-156: finishPresentation moves to COMPLETED', async () => {
    (workflow as any).state = 'GENERATING_PRESENTATION';
    (workflow as any).data = { clientCompanyName: 'MiEmpresa', clientEmail: 'info@miempresa.com', proposalContent: 'Propuesta de valor' };
    mockGenerateContent.mockResolvedValue({ response: { text: () => '# Contenido de diapositiva formateado' } });

    await (workflow as any).finishPresentation();
    expect((workflow as any).state).toBe('COMPLETED');
    expect(mockSendText).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('Flujo Completado'));
  });
});
