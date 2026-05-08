import { beforeEach, describe, expect, it } from 'vitest';
import { PRESENTATION_TRANSITIONS, WorkflowEngine as FixtureWorkflowEngine } from '../workflow-engine.fixture';
import { MockCRMStore as FixtureCRMStore } from '../crm-workflow.fixture';

describe('CRM workflow entity operations', () => {
  let store: FixtureCRMStore;

  beforeEach(() => {
    store = new FixtureCRMStore();
  });

  it('CRM-WF-001: creates a company and linked contact', () => {
    const company = store.forceCreateCompany('TechCorp SA', { industry: 'Tecnologia' });
    const contact = store.createContact('Maria Lopez', company.id, 'maria@techcorp.com');

    expect(company.id).toBeDefined();
    expect(contact.company_id).toBe(company.id);
    expect(store.companies).toHaveLength(1);
    expect(store.contacts).toHaveLength(1);
  });

  it('CRM-WF-002: rejects duplicate companies with Jaccard deduplication', () => {
    store.forceCreateCompany('Acme Corporation');
    expect(() => store.createCompany('Acme Corporations')).toThrow('Empresa duplicada detectada');
    expect(store.companies).toHaveLength(1);
  });

  it('CRM-WF-004: creates an opportunity after HITL approval', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: [
        { from: 'AWAITING_DATA', to: 'PROCESSING_PROPOSAL' },
        { from: 'PROCESSING_PROPOSAL', to: 'AWAITING_APPROVAL', requiresApproval: true },
        { from: 'AWAITING_APPROVAL', to: 'COMPLETED' },
      ],
      traceId: 'crm-trace-004',
    });

    engine.transition('PROCESSING_PROPOSAL');
    engine.approve('PROCESSING_PROPOSAL->AWAITING_APPROVAL');
    expect(engine.transition('AWAITING_APPROVAL').success).toBe(true);

    const company = store.forceCreateCompany('ClienteCorp');
    const opportunity = store.createOpportunity('Proyecto IA', company.id, 75000);
    expect(opportunity.status).toBe('open');
    expect(opportunity.value).toBe(75000);
  });

  it('CRM-WF-005: idempotency avoids duplicate opportunity creation', () => {
    const engine = new FixtureWorkflowEngine({
      initialState: 'AWAITING_DATA',
      transitions: PRESENTATION_TRANSITIONS,
      traceId: 'crm-trace-005',
    });

    expect(engine.transition('PROCESSING_PROPOSAL', 'crear-opp-001').success).toBe(true);
    const company = store.forceCreateCompany('Empresa Test');
    store.createOpportunity('Opp 1', company.id, 10000);
    expect(engine.transition('PROCESSING_PROPOSAL', 'crear-opp-001').success).toBe(true);
    expect(store.opportunities).toHaveLength(1);
  });
});
