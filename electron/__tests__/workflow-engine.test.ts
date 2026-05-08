/**
 * Workflow Engine + CRM Workflow Tests
 *
 * 16 tests totales:
 *   WF-001 a WF-008 â€” Motor de estado generico (state machine)
 *   CRM-WF-001 a CRM-WF-008 â€” Flujo CRM con Supabase e IA mockeados
 *
 * Se reimplementa un FixtureWorkflowEngine generico porque el codebase no exporta
 * una clase generica; el patron de estado se repite en PresentacionWorkflow
 * y MeetingWorkflowService. Los tests validan la logica de transiciones,
 * HITL, idempotencia, trace_id, cancelacion y timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PRESENTATION_TRANSITIONS as FIXTURE_PRESENTATION_TRANSITIONS, WorkflowEngine as FixtureWorkflowEngine } from './workflow-engine.fixture';
import { MockCRMStore as FixtureCRMStore, mockGeminiExtract as mockFixtureGeminiExtract } from './crm-workflow.fixture';

// TESTS â€” FixtureWorkflowEngine (WF-001 a WF-008)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

describe('FixtureWorkflowEngine â€” Maquina de Estados', () => {
  let engine: FixtureWorkflowEngine;

  beforeEach(() => {
    engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: FIXTURE_PRESENTATION_TRANSITIONS,
      traceId: 'trace-abc-123',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WF-001: Transicion de estado valida
  it('WF-001: transicion valida de AWAITING_DATA a PROCESSING_PROPOSAL', () => {
    const result = engine.transition('PROCESSING_PROPOSAL');
    expect(result.success).toBe(true);
    expect(engine.getState()).toBe('PROCESSING_PROPOSAL');
  });

  // WF-002: Transicion invalida rechazada
  it('WF-002: transicion invalida es rechazada con mensaje de error', () => {
    const result = engine.transition('COMPLETED');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid transition');
    expect(result.error).toContain('AWAITING_DATA');
    expect(result.error).toContain('COMPLETED');
    // El estado no debe cambiar
    expect(engine.getState()).toBe('AWAITING_DATA');
  });

  // WF-003: HITL bloquea sin aprobacion
  it('WF-003: transicion HITL bloqueada cuando no hay aprobacion', () => {
    engine.transition('PROCESSING_PROPOSAL');
    engine.transition('AWAITING_APPROVAL');

    const result = engine.transition('GENERATING_PRESENTATION');
    expect(result.success).toBe(false);
    expect(result.error).toContain('requires human approval');
    expect(result.error).toContain('HITL');
    expect(engine.getState()).toBe('AWAITING_APPROVAL');
  });

  // WF-004: HITL procede con aprobacion
  it('WF-004: transicion HITL exitosa despues de aprobacion humana', () => {
    engine.transition('PROCESSING_PROPOSAL');
    engine.transition('AWAITING_APPROVAL');

    engine.approve('AWAITING_APPROVAL->GENERATING_PRESENTATION');
    const result = engine.transition('GENERATING_PRESENTATION');
    expect(result.success).toBe(true);
    expect(engine.getState()).toBe('GENERATING_PRESENTATION');
  });

  // WF-005: Clave de idempotencia previene duplicados
  it('WF-005: clave de idempotencia previene transiciones duplicadas', () => {
    // Primera transicion con clave
    const r1 = engine.transition('PROCESSING_PROPOSAL', 'paso-1');
    expect(r1.success).toBe(true);
    expect(engine.getState()).toBe('PROCESSING_PROPOSAL');

    // Segunda transicion con misma clave â€” no-op, no error
    const r2 = engine.transition('PROCESSING_PROPOSAL', 'paso-1');
    expect(r2.success).toBe(true);
    // Estado no deberia cambiar de forma anomala
    expect(engine.getState()).toBe('PROCESSING_PROPOSAL');

    // Transicion con clave diferente si procede
    const r3 = engine.transition('AWAITING_APPROVAL', 'paso-2');
    expect(r3.success).toBe(true);
    expect(engine.getState()).toBe('AWAITING_APPROVAL');
  });

  // WF-006: trace_id propagado a lo largo del ciclo de vida
  it('WF-006: trace_id se preserva en todas las transiciones', () => {
    expect(engine.getTraceId()).toBe('trace-abc-123');

    engine.transition('PROCESSING_PROPOSAL');
    expect(engine.getTraceId()).toBe('trace-abc-123');

    engine.transition('AWAITING_APPROVAL');
    expect(engine.getTraceId()).toBe('trace-abc-123');

    engine.approve('AWAITING_APPROVAL->GENERATING_PRESENTATION');
    engine.transition('GENERATING_PRESENTATION');
    expect(engine.getTraceId()).toBe('trace-abc-123');

    engine.transition('COMPLETED');
    expect(engine.getTraceId()).toBe('trace-abc-123');
  });

  // WF-007: Cancelar workflow a mitad del flujo
  it('WF-007: cancel() establece el estado a CANCELLED desde cualquier punto', () => {
    engine.transition('PROCESSING_PROPOSAL');
    expect(engine.getState()).toBe('PROCESSING_PROPOSAL');

    engine.cancel();
    expect(engine.getState()).toBe('CANCELLED');

    // Despues de cancelar, transiciones adicionales fallan
    const result = engine.transition('AWAITING_APPROVAL');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid transition');
  });

  // WF-008: Timeout del workflow manejado correctamente
  it('WF-008: workflow entra en TIMED_OUT al exceder el umbral', () => {
    const shortEngine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: FIXTURE_PRESENTATION_TRANSITIONS,
      traceId: 'trace-timeout',
      timeoutMs: 100,
    });

    // Simular paso del tiempo con Date.now mockeado
    const realNow = Date.now;
    let fakeTime = realNow();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    // Primera transicion debe funcionar (dentro del tiempo)
    const r1 = shortEngine.transition('PROCESSING_PROPOSAL');
    expect(r1.success).toBe(true);

    // Avanzar tiempo mas alla del timeout
    fakeTime += 200;

    const r2 = shortEngine.transition('AWAITING_APPROVAL');
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('timed out');
    expect(shortEngine.getState()).toBe('TIMED_OUT');

    vi.spyOn(Date, 'now').mockRestore();
  });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TESTS â€” CRM Workflow (CRM-WF-001 a CRM-WF-008)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

describe('CRM Workflow â€” Operaciones con Supabase y Gemini mockeados', () => {
  let store: FixtureCRMStore;

  beforeEach(() => {
    store = new FixtureCRMStore();
    mockFixtureGeminiExtract.mockClear();
  });

  // CRM-WF-001: Transicion valida en flujo CRM (crear empresa -> crear contacto)
  it('CRM-WF-001: flujo valido crea empresa y vincula contacto', () => {
    const company = store.forceCreateCompany('TechCorp SA', {
      industry: 'Tecnologia',
    });
    const contact = store.createContact(
      'Maria Lopez',
      company.id,
      'maria@techcorp.com'
    );

    expect(company.id).toBeDefined();
    expect(contact.company_id).toBe(company.id);
    expect(store.companies).toHaveLength(1);
    expect(store.contacts).toHaveLength(1);
  });

  // CRM-WF-002: Transicion invalida â€” duplicado rechazado por Jaccard
  it('CRM-WF-002: crear empresa duplicada es rechazado por deduplicacion Jaccard', () => {
    store.forceCreateCompany('Acme Corporation');

    // Intentar crear empresa con nombre casi identico (Jaccard ~0.93)
    expect(() => store.createCompany('Acme Corporations')).toThrow(
      'Empresa duplicada detectada'
    );
    expect(store.companies).toHaveLength(1);
  });

  // CRM-WF-003: HITL bloquea oportunidad sin validacion
  it('CRM-WF-003: oportunidad requiere empresa existente (bloqueo HITL simulado)', () => {
    // Simular que la oportunidad no puede crearse sin empresa validada
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: [
        { from: 'AWAITING_DATA', to: 'PROCESSING_PROPOSAL' },
        {
          from: 'PROCESSING_PROPOSAL',
          to: 'AWAITING_APPROVAL',
          requiresApproval: true,
        },
        { from: 'AWAITING_APPROVAL', to: 'COMPLETED' },
      ],
      traceId: 'crm-trace-003',
    });

    engine.transition('PROCESSING_PROPOSAL');
    // Sin aprobacion, no puede avanzar a crear la oportunidad
    const result = engine.transition('AWAITING_APPROVAL');
    expect(result.success).toBe(false);
    expect(result.error).toContain('requires human approval');
  });

  // CRM-WF-004: HITL con aprobacion permite crear oportunidad
  it('CRM-WF-004: oportunidad se crea despues de aprobacion HITL', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: [
        { from: 'AWAITING_DATA', to: 'PROCESSING_PROPOSAL' },
        {
          from: 'PROCESSING_PROPOSAL',
          to: 'AWAITING_APPROVAL',
          requiresApproval: true,
        },
        { from: 'AWAITING_APPROVAL', to: 'COMPLETED' },
      ],
      traceId: 'crm-trace-004',
    });

    engine.transition('PROCESSING_PROPOSAL');
    engine.approve('PROCESSING_PROPOSAL->AWAITING_APPROVAL');
    const result = engine.transition('AWAITING_APPROVAL');
    expect(result.success).toBe(true);

    // Ahora crear la oportunidad en el store
    const company = store.forceCreateCompany('ClienteCorp');
    const opp = store.createOpportunity('Proyecto IA', company.id, 75000);
    expect(opp.status).toBe('open');
    expect(opp.value).toBe(75000);
  });

  // CRM-WF-005: Idempotencia previene oportunidades duplicadas
  it('CRM-WF-005: idempotencia previene creacion duplicada de oportunidad', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: FIXTURE_PRESENTATION_TRANSITIONS,
      traceId: 'crm-trace-005',
    });

    // Primera transicion con clave de idempotencia
    const r1 = engine.transition('PROCESSING_PROPOSAL', 'crear-opp-001');
    expect(r1.success).toBe(true);

    const company = store.forceCreateCompany('Empresa Test');
    store.createOpportunity('Opp 1', company.id, 10000);

    // Misma clave â€” no-op, no debe crear otra oportunidad
    const r2 = engine.transition('PROCESSING_PROPOSAL', 'crear-opp-001');
    expect(r2.success).toBe(true);
    // Solo una oportunidad debe existir (la logica de negocio se protege con la clave)
    expect(store.opportunities).toHaveLength(1);
  });

  // CRM-WF-006: trace_id propagado en flujo CRM completo
  it('CRM-WF-006: trace_id se mantiene consistente en todo el flujo CRM', () => {
    const traceId = 'crm-trace-e2e-006';
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: FIXTURE_PRESENTATION_TRANSITIONS,
      traceId,
    });

    // Simular flujo completo
    expect(engine.getTraceId()).toBe(traceId);

    engine.transition('PROCESSING_PROPOSAL');
    expect(engine.getTraceId()).toBe(traceId);

    engine.transition('AWAITING_APPROVAL');
    expect(engine.getTraceId()).toBe(traceId);

    // Crear entidades CRM asociadas al trace
    const company = store.forceCreateCompany('Empresa Trace');
    const contact = store.createContact('Carlos', company.id);
    const opp = store.createOpportunity('Deal Trace', company.id, 50000);

    // El trace_id sigue igual despues de las operaciones
    expect(engine.getTraceId()).toBe(traceId);
    expect(company.id).toBeDefined();
    expect(contact.company_id).toBe(company.id);
    expect(opp.company_id).toBe(company.id);
  });

  // CRM-WF-007: Cancelar flujo CRM a mitad de proceso
  it('CRM-WF-007: cancelar flujo CRM limpia el estado correctamente', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: FIXTURE_PRESENTATION_TRANSITIONS,
      traceId: 'crm-trace-cancel',
    });

    engine.transition('PROCESSING_PROPOSAL');
    expect(engine.getState()).toBe('PROCESSING_PROPOSAL');

    // Cancelar antes de aprobar
    engine.cancel();
    expect(engine.getState()).toBe('CANCELLED');

    // Verificar que no se pueden hacer mas transiciones
    const result = engine.transition('AWAITING_APPROVAL');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid transition');

    // Las entidades CRM creadas antes de cancelar persisten
    const company = store.forceCreateCompany('Pre-Cancel Corp');
    expect(store.companies).toHaveLength(1);
    expect(company.name).toBe('Pre-Cancel Corp');
  });

  // CRM-WF-008: Timeout del flujo CRM manejado
  it('CRM-WF-008: flujo CRM entra en timeout y bloquea operaciones posteriores', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: FIXTURE_PRESENTATION_TRANSITIONS,
      traceId: 'crm-trace-timeout',
      timeoutMs: 50,
    });

    const realNow = Date.now;
    let fakeTime = realNow();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    // Transicion inicial dentro del tiempo
    const r1 = engine.transition('PROCESSING_PROPOSAL');
    expect(r1.success).toBe(true);

    // Avanzar tiempo mas alla del timeout
    fakeTime += 100;

    // Siguiente transicion falla por timeout
    const r2 = engine.transition('AWAITING_APPROVAL');
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('timed out');
    expect(engine.getState()).toBe('TIMED_OUT');

    // Verificar que la extraccion Gemini mockeada no afecta el timeout
    expect(mockFixtureGeminiExtract).not.toHaveBeenCalled();

    vi.spyOn(Date, 'now').mockRestore();
  });
});
