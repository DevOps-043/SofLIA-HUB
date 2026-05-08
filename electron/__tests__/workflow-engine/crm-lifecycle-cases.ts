import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESENTATION_TRANSITIONS, WorkflowEngine as FixtureWorkflowEngine } from '../workflow-engine.fixture';
import {
  MockCRMStore as FixtureCRMStore,
  mockGeminiExtract as mockFixtureGeminiExtract,
} from '../crm-workflow.fixture';

describe('CRM workflow lifecycle controls', () => {
  let store: FixtureCRMStore;

  beforeEach(() => {
    store = new FixtureCRMStore();
    mockFixtureGeminiExtract.mockClear();
  });

  it('CRM-WF-003: blocks opportunity flow without HITL approval', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: [
        { from: 'AWAITING_DATA', to: 'PROCESSING_PROPOSAL' },
        { from: 'PROCESSING_PROPOSAL', to: 'AWAITING_APPROVAL', requiresApproval: true },
        { from: 'AWAITING_APPROVAL', to: 'COMPLETED' },
      ],
      traceId: 'crm-trace-003',
    });

    engine.transition('PROCESSING_PROPOSAL');
    const result = engine.transition('AWAITING_APPROVAL');
    expect(result.success).toBe(false);
    expect(result.error).toContain('requires human approval');
  });

  it('CRM-WF-006: keeps trace_id consistent while entities are created', () => {
    const traceId = 'crm-trace-e2e-006';
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
      traceId,
    });

    engine.transition('PROCESSING_PROPOSAL');
    engine.transition('AWAITING_APPROVAL');
    const company = store.forceCreateCompany('Empresa Trace');
    const contact = store.createContact('Carlos', company.id);
    const opportunity = store.createOpportunity('Deal Trace', company.id, 50000);

    expect(engine.getTraceId()).toBe(traceId);
    expect(contact.company_id).toBe(company.id);
    expect(opportunity.company_id).toBe(company.id);
  });

  it('CRM-WF-007: cancel blocks later transitions while keeping prior entities', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
      traceId: 'crm-trace-cancel',
    });

    engine.transition('PROCESSING_PROPOSAL');
    engine.cancel();
    expect(engine.getState()).toBe('CANCELLED');
    expect(engine.transition('AWAITING_APPROVAL').success).toBe(false);
    expect(store.forceCreateCompany('Pre-Cancel Corp').name).toBe('Pre-Cancel Corp');
  });

  it('CRM-WF-008: timeout blocks later workflow operations', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
      traceId: 'crm-trace-timeout',
      timeoutMs: 50,
    });
    let fakeTime = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

    expect(engine.transition('PROCESSING_PROPOSAL').success).toBe(true);
    fakeTime += 100;
    const result = engine.transition('AWAITING_APPROVAL');
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(engine.getState()).toBe('TIMED_OUT');
    expect(mockFixtureGeminiExtract).not.toHaveBeenCalled();
    vi.spyOn(Date, 'now').mockRestore();
  });
});
