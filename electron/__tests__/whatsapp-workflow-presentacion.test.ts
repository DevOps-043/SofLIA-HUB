import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// WhatsApp Workflow Presentacion Tests (WA-151 to WA-160)
// Tests for electron/whatsapp-workflow-presentacion.ts
// ============================================================================

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock WhatsApp Service
const mockSendText = vi.fn().mockResolvedValue(undefined);
const mockWaService = {
  sendText: mockSendText,
  isConnected: vi.fn().mockReturnValue(true),
};

// Mock Gemini API
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});
const mockGenAI = {
  getGenerativeModel: mockGetGenerativeModel,
};

// Mock WhatsApp Agent (provee getGenAI)
const mockAgent = {
  getGenAI: vi.fn().mockReturnValue(mockGenAI),
};

// Mock whatsapp-service (importado por el modulo de workflow)
vi.mock('../whatsapp-service', () => ({
  WhatsAppService: vi.fn(),
}));

// Mock whatsapp-agent
vi.mock('../whatsapp-agent', () => ({
  WhatsAppAgent: vi.fn(),
}));

// Mock fetch para Gamma API
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { PresentacionWorkflow, WorkflowManager } from '../whatsapp-workflow-presentacion';

// ============================================================================
// Tests
// ============================================================================

describe('PresentacionWorkflow', () => {
  let workflow: PresentacionWorkflow;

  beforeEach(() => {
    vi.clearAllMocks();
    // Resetear estado del WorkflowManager
    WorkflowManager.endWorkflow('test-session');

    workflow = new PresentacionWorkflow(
      'test-session',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      mockAgent as any,
    );

    // Mock por defecto de Gemini: retorna JSON valido para extraccion de datos
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"company": "TechCorp", "email": "test@techcorp.com"}' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // WA-151: El estado inicial es AWAITING_DATA
  it('WA-151: el workflow inicia en estado AWAITING_DATA', async () => {
    await workflow.start();
    expect(mockSendText).toHaveBeenCalledWith(
      '5551234567@s.whatsapp.net',
      expect.stringContaining('presentación ejecutiva'),
    );
    // El estado interno debe ser AWAITING_DATA
    expect((workflow as any).state).toBe('AWAITING_DATA');
  });

  // WA-152: Transicion a PROCESSING_PROPOSAL
  it('WA-152: transiciona a PROCESSING_PROPOSAL cuando se extraen empresa y correo', async () => {
    await workflow.start();
    const handled = await workflow.handleInput('Empresa TechCorp y mi correo es test@techcorp.com');
    expect(handled).toBe(true);
    expect((workflow as any).state).toBe('PROCESSING_PROPOSAL');
    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('TechCorp'),
    );
  });

  // WA-153: Transicion a AWAITING_APPROVAL
  it('WA-153: transiciona a AWAITING_APPROVAL despues de generar la propuesta', async () => {
    await workflow.start();

    // Mock extraccion
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => '{"company": "Acme", "email": "info@acme.com"}' } })
      // Mock conocimiento externo
      .mockResolvedValueOnce({ response: { text: () => 'Acme es una empresa de tecnologia.' } })
      // Mock contenido de propuesta
      .mockResolvedValueOnce({ response: { text: () => '1. Automatizacion\n2. IA\n3. Integraciones' } });

    await workflow.handleInput('Empresa Acme correo info@acme.com');

    // Esperar a que generateProposal en background termine
    await vi.waitFor(() => {
      expect((workflow as any).state).toBe('AWAITING_APPROVAL');
    }, { timeout: 2000 });

    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Resumen Ejecutivo'),
    );
  });

  // WA-154: Aprobacion HITL transiciona a GENERATING_PRESENTATION
  it('WA-154: aprobacion HITL con "si" transiciona a GENERATING_PRESENTATION', async () => {
    // Establecer estado manualmente a AWAITING_APPROVAL
    (workflow as any).state = 'AWAITING_APPROVAL';
    (workflow as any).data = {
      clientCompanyName: 'TechCorp',
      clientEmail: 'test@techcorp.com',
      proposalContent: 'Resumen de prueba',
    };

    // Mock Gamma API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'gen-123' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'completed', gammaUrl: 'https://gamma.app/xyz' }),
    });

    // Mock Gemini para gammaPrompt
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '# Slide 1\n## Introduccion' },
    });

    const handled = await workflow.handleInput('sí');
    expect(handled).toBe(true);
    expect((workflow as any).state).toBe('GENERATING_PRESENTATION');
    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Aprobado'),
    );
  });

  // WA-155: Rechazo HITL regresa a solicitud de datos (termina workflow)
  it('WA-155: rechazo HITL con "cancelar" finaliza el workflow', async () => {
    (workflow as any).state = 'AWAITING_APPROVAL';

    const handled = await workflow.handleInput('no, cancelar');
    expect(handled).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('cancelado'),
    );
  });

  // WA-156: Transicion a COMPLETED
  it('WA-156: finishPresentation transiciona al estado COMPLETED', async () => {
    (workflow as any).state = 'GENERATING_PRESENTATION';
    (workflow as any).data = {
      clientCompanyName: 'MiEmpresa',
      clientEmail: 'info@miempresa.com',
      proposalContent: 'Propuesta de valor',
    };

    // Mock Gemini para formato gamma
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '# Contenido de diapositiva formateado' },
    });

    // Mock Gamma API (sin clave configurada)
    delete process.env.VITE_GAMMA_API_KEY;
    delete process.env.GAMMA_API_KEY;

    await (workflow as any).finishPresentation();
    expect((workflow as any).state).toBe('COMPLETED');
    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Flujo Completado'),
    );
  });

  // WA-157: Datos de empresa extraidos del texto
  it('WA-157: extractData extrae el nombre de empresa del texto via Gemini', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"company": "DevOps Corp", "email": null}' },
    });

    await (workflow as any).extractData('La empresa es DevOps Corp');
    expect((workflow as any).data.clientCompanyName).toBe('DevOps Corp');
  });

  // WA-158: Correo electronico extraido del texto
  it('WA-158: extractData extrae el correo electronico del texto via Gemini', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"company": null, "email": "user@example.com"}' },
    });

    await (workflow as any).extractData('mi correo es user@example.com');
    expect((workflow as any).data.clientEmail).toBe('user@example.com');
  });

  // WA-159: Transicion invalida rechazada
  it('WA-159: rechaza input adicional durante GENERATING_PRESENTATION con mensaje de espera', async () => {
    (workflow as any).state = 'GENERATING_PRESENTATION';

    const handled = await workflow.handleInput('apúrate');
    expect(handled).toBe(true);
    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Terminando de generar'),
    );
  });

  // WA-160: Gamma API invocada para generacion de PDF
  it('WA-160: finishPresentation invoca Gamma API cuando la clave esta disponible', async () => {
    process.env.VITE_GAMMA_API_KEY = 'test-gamma-key';
    (workflow as any).state = 'GENERATING_PRESENTATION';
    (workflow as any).data = {
      clientCompanyName: 'TestCo',
      clientEmail: 'test@testco.com',
      proposalContent: 'Propuesta de prueba',
    };

    mockGenerateContent.mockResolvedValue({
      response: { text: () => '# Contenido formateado' },
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'gamma-gen-456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', gammaUrl: 'https://gamma.app/result' }),
      });

    await (workflow as any).finishPresentation();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://public-api.gamma.app/v1.0/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-KEY': 'test-gamma-key',
        }),
      }),
    );

    expect((workflow as any).state).toBe('COMPLETED');
    delete process.env.VITE_GAMMA_API_KEY;
  });

  it('WA-161: permite cancelar el flujo desde AWAITING_DATA con lenguaje natural', async () => {
    const extractSpy = vi.spyOn(workflow as any, 'extractData');

    const handled = await workflow.handleInput('Cancela el flujo');

    expect(handled).toBe(false);
    expect(extractSpy).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('cancelado'),
    );
  });

  it('WA-162: cancela el flujo por inactividad despues de 5 minutos', async () => {
    vi.useFakeTimers();

    await WorkflowManager.startWorkflow(
      'mgr-timeout',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      mockAgent as any,
    );

    expect(WorkflowManager.isActive('mgr-timeout')).toBe(true);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(WorkflowManager.isActive('mgr-timeout')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(
      '5551234567@s.whatsapp.net',
      expect.stringContaining('inactividad'),
    );
  });
});

describe('WorkflowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WorkflowManager.endWorkflow('mgr-test');
  });

  it('isActive retorna false para sesion inexistente', () => {
    expect(WorkflowManager.isActive('nonexistent')).toBe(false);
  });

  it('startWorkflow crea un workflow activo', async () => {
    await WorkflowManager.startWorkflow(
      'mgr-test',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      mockAgent as any,
    );
    expect(WorkflowManager.isActive('mgr-test')).toBe(true);
  });

  it('endWorkflow elimina el workflow activo', async () => {
    await WorkflowManager.startWorkflow(
      'mgr-test',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      mockAgent as any,
    );
    WorkflowManager.endWorkflow('mgr-test');
    expect(WorkflowManager.isActive('mgr-test')).toBe(false);
  });
});
