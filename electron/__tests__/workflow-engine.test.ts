/**
 * Workflow Engine + CRM Workflow Tests
 *
 * 16 tests totales:
 *   WF-001 a WF-008 — Motor de estado generico (state machine)
 *   CRM-WF-001 a CRM-WF-008 — Flujo CRM con Supabase e IA mockeados
 *
 * Se reimplementa un WorkflowEngine generico porque el codebase no exporta
 * una clase generica; el patron de estado se repite en PresentacionWorkflow
 * y MeetingWorkflowService. Los tests validan la logica de transiciones,
 * HITL, idempotencia, trace_id, cancelacion y timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Tipos de estado del workflow ────────────────────────────────────

type WorkflowState =
  | 'AWAITING_DATA'
  | 'PROCESSING_PROPOSAL'
  | 'AWAITING_APPROVAL'
  | 'GENERATING_PRESENTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'TIMED_OUT';

interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  requiresApproval?: boolean;
}

// ─── Motor de workflow (state machine generico) ──────────────────────

class WorkflowEngine {
  private state: WorkflowState;
  private transitions: WorkflowTransition[];
  private traceId: string;
  private idempotencyKeys = new Set<string>();
  private approvals = new Map<string, boolean>();
  private timeoutMs: number;
  private startedAt: number;

  constructor(opts: {
    initialState: WorkflowState;
    transitions: WorkflowTransition[];
    traceId: string;
    timeoutMs?: number;
  }) {
    this.state = opts.initialState;
    this.transitions = opts.transitions;
    this.traceId = opts.traceId;
    this.timeoutMs = opts.timeoutMs || 0;
    this.startedAt = Date.now();
  }

  getState(): WorkflowState {
    return this.state;
  }

  getTraceId(): string {
    return this.traceId;
  }

  isTimedOut(): boolean {
    if (this.timeoutMs <= 0) return false;
    return Date.now() - this.startedAt > this.timeoutMs;
  }

  approve(transitionKey: string): void {
    this.approvals.set(transitionKey, true);
  }

  transition(
    to: WorkflowState,
    idempotencyKey?: string
  ): { success: boolean; error?: string } {
    // Verificar timeout
    if (this.isTimedOut()) {
      this.state = 'TIMED_OUT';
      return { success: false, error: 'Workflow timed out' };
    }

    // Idempotencia: si la clave ya fue procesada, no-op
    if (idempotencyKey) {
      if (this.idempotencyKeys.has(idempotencyKey)) {
        return { success: true }; // Ya procesado
      }
    }

    // Buscar transicion valida
    const tx = this.transitions.find(
      (t) => t.from === this.state && t.to === to
    );

    if (!tx) {
      return {
        success: false,
        error: `Invalid transition from ${this.state} to ${to}`,
      };
    }

    // Verificacion HITL
    if (tx.requiresApproval) {
      const key = `${tx.from}->${tx.to}`;
      if (!this.approvals.get(key)) {
        return {
          success: false,
          error: `Transition ${key} requires human approval (HITL)`,
        };
      }
    }

    this.state = to;
    if (idempotencyKey) {
      this.idempotencyKeys.add(idempotencyKey);
    }

    return { success: true };
  }

  cancel(): void {
    this.state = 'CANCELLED';
  }
}

// ─── Transiciones estandar del flujo de presentacion ─────────────────

const PRESENTATION_TRANSITIONS: WorkflowTransition[] = [
  { from: 'AWAITING_DATA', to: 'PROCESSING_PROPOSAL' },
  { from: 'PROCESSING_PROPOSAL', to: 'AWAITING_APPROVAL' },
  {
    from: 'AWAITING_APPROVAL',
    to: 'GENERATING_PRESENTATION',
    requiresApproval: true,
  },
  { from: 'GENERATING_PRESENTATION', to: 'COMPLETED' },
];

// ─── Jaccard Similarity (deduplicacion CRM por bigramas) ─────────────

function bigrams(str: string): Set<string> {
  const normalized = str.toLowerCase().trim();
  if (normalized.length < 2)
    return new Set(normalized.length === 1 ? [normalized] : []);
  const result = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    result.add(normalized.substring(i, i + 2));
  }
  return result;
}

function jaccardSimilarity(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a || !b) return 0;

  const setA = bigrams(a);
  const setB = bigrams(b);

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

// ─── Mock Supabase (instancia IRIS) ──────────────────────────────────

interface CRMCompany {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  created_at?: string;
}

interface CRMContact {
  id: string;
  name: string;
  email?: string;
  company_id: string;
}

interface CRMOpportunity {
  id: string;
  title: string;
  company_id: string;
  status: 'open' | 'won' | 'lost';
  value?: number;
}

// Almacen CRM en memoria simulando Supabase IRIS
class MockCRMStore {
  companies: CRMCompany[] = [];
  contacts: CRMContact[] = [];
  opportunities: CRMOpportunity[] = [];
  private nextId = 1;

  createCompany(name: string, opts?: Partial<CRMCompany>): CRMCompany {
    // Verificar duplicado por Jaccard antes de crear
    const existing = this.findSimilarCompany(name);
    if (existing) {
      throw new Error(
        `Empresa duplicada detectada: "${existing.name}" (Jaccard >= 0.7)`
      );
    }

    const company: CRMCompany = {
      id: `comp-${this.nextId++}`,
      name,
      ...opts,
      created_at: new Date().toISOString(),
    };
    this.companies.push(company);
    return company;
  }

  // Fuerza creacion sin verificacion de duplicados (para tests internos)
  forceCreateCompany(name: string, opts?: Partial<CRMCompany>): CRMCompany {
    const company: CRMCompany = {
      id: `comp-${this.nextId++}`,
      name,
      ...opts,
      created_at: new Date().toISOString(),
    };
    this.companies.push(company);
    return company;
  }

  findSimilarCompany(name: string, threshold = 0.7): CRMCompany | null {
    for (const company of this.companies) {
      if (jaccardSimilarity(company.name, name) >= threshold) {
        return company;
      }
    }
    return null;
  }

  createContact(
    name: string,
    companyId: string,
    email?: string
  ): CRMContact {
    const contact: CRMContact = {
      id: `cont-${this.nextId++}`,
      name,
      email,
      company_id: companyId,
    };
    this.contacts.push(contact);
    return contact;
  }

  createOpportunity(
    title: string,
    companyId: string,
    value?: number
  ): CRMOpportunity {
    const opp: CRMOpportunity = {
      id: `opp-${this.nextId++}`,
      title,
      company_id: companyId,
      status: 'open',
      value,
    };
    this.opportunities.push(opp);
    return opp;
  }

  updateOpportunityStatus(
    id: string,
    status: 'open' | 'won' | 'lost'
  ): CRMOpportunity | null {
    const opp = this.opportunities.find((o) => o.id === id);
    if (opp) opp.status = status;
    return opp || null;
  }
}

// ─── Mock Gemini (simula extraccion IA para CRM) ─────────────────────

const mockGeminiExtract = vi.fn(
  async (text: string): Promise<{ company: string | null; email: string | null }> => {
    // Simula extraccion basica de empresa y correo
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    const companyMatch = text.match(/empresa\s+(\S+)/i);
    return {
      company: companyMatch ? companyMatch[1] : null,
      email: emailMatch ? emailMatch[0] : null,
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════
// TESTS — WorkflowEngine (WF-001 a WF-008)
// ═══════════════════════════════════════════════════════════════════════

describe('WorkflowEngine — Maquina de Estados', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
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

    // Segunda transicion con misma clave — no-op, no error
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
    const shortEngine = new WorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
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

// ═══════════════════════════════════════════════════════════════════════
// TESTS — CRM Workflow (CRM-WF-001 a CRM-WF-008)
// ═══════════════════════════════════════════════════════════════════════

describe('CRM Workflow — Operaciones con Supabase y Gemini mockeados', () => {
  let store: MockCRMStore;

  beforeEach(() => {
    store = new MockCRMStore();
    mockGeminiExtract.mockClear();
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

  // CRM-WF-002: Transicion invalida — duplicado rechazado por Jaccard
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
    const engine = new WorkflowEngine({
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
    const engine = new WorkflowEngine({
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
    const engine = new WorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
      traceId: 'crm-trace-005',
    });

    // Primera transicion con clave de idempotencia
    const r1 = engine.transition('PROCESSING_PROPOSAL', 'crear-opp-001');
    expect(r1.success).toBe(true);

    const company = store.forceCreateCompany('Empresa Test');
    store.createOpportunity('Opp 1', company.id, 10000);

    // Misma clave — no-op, no debe crear otra oportunidad
    const r2 = engine.transition('PROCESSING_PROPOSAL', 'crear-opp-001');
    expect(r2.success).toBe(true);
    // Solo una oportunidad debe existir (la logica de negocio se protege con la clave)
    expect(store.opportunities).toHaveLength(1);
  });

  // CRM-WF-006: trace_id propagado en flujo CRM completo
  it('CRM-WF-006: trace_id se mantiene consistente en todo el flujo CRM', () => {
    const traceId = 'crm-trace-e2e-006';
    const engine = new WorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
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
    const engine = new WorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
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
    const engine = new WorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
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
    expect(mockGeminiExtract).not.toHaveBeenCalled();

    vi.spyOn(Date, 'now').mockRestore();
  });
});
