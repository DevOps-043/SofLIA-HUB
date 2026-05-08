import { describe, it, expect, beforeEach } from 'vitest';
import { jaccardSimilarity, MockCRMStore } from './crm-service.fixture';

describe('CRM Service - Jaccard Deduplication & CRUD', () => {
  let store: MockCRMStore;

  beforeEach(() => {
    store = new MockCRMStore();
  });

  it('CRM-001: createCompany stores a new company with generated id', () => {
    const company = store.createCompany('Acme Corp', { industry: 'Tech' });
    expect(company.id).toBeDefined();
    expect(company.name).toBe('Acme Corp');
    expect(company.industry).toBe('Tech');
    expect(company.created_at).toBeDefined();
    expect(store.companies).toHaveLength(1);
  });

  it('CRM-002: Jaccard detects similar names', () => {
    expect(jaccardSimilarity('Acme Corp', 'Acme Corporation')).toBeGreaterThan(0.5);
    store.createCompany('Acme Corp');
    const found = store.findSimilarCompany('Acme Corporation', 0.5);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Acme Corp');
  });

  it('CRM-003: Jaccard passes different names', () => {
    expect(jaccardSimilarity('Acme', 'Globex')).toBeLessThan(0.3);
    store.createCompany('Acme');
    expect(store.findSimilarCompany('Globex', 0.5)).toBeNull();
  });

  it('CRM-004: createContact links contact to correct company', () => {
    const company = store.createCompany('DevOps Inc');
    const contact = store.createContact('Juan Perez', company.id, 'juan@devops.com');
    expect(contact.company_id).toBe(company.id);
    expect(contact.name).toBe('Juan Perez');
    expect(contact.email).toBe('juan@devops.com');
    expect(store.contacts).toHaveLength(1);
  });

  it('CRM-005: opportunity status transitions through lifecycle', () => {
    const company = store.createCompany('Client SA');
    const opp = store.createOpportunity('Proyecto IA', company.id, 50000);
    expect(opp.status).toBe('open');
    store.updateOpportunityStatus(opp.id, 'won');
    expect(opp.status).toBe('won');
    store.updateOpportunityStatus(opp.id, 'lost');
    expect(opp.status).toBe('lost');
  });

  it('CRM-006: Jaccard returns 0 for empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(0);
    expect(jaccardSimilarity('Acme', '')).toBe(0);
    expect(jaccardSimilarity('', 'Globex')).toBe(0);
  });

  it('CRM-007: Jaccard returns 1.0 for identical strings', () => {
    expect(jaccardSimilarity('Acme Corp', 'Acme Corp')).toBe(1.0);
    expect(jaccardSimilarity('Globex Industries', 'Globex Industries')).toBe(1.0);
  });

  it('CRM-008: Jaccard is case insensitive', () => {
    expect(jaccardSimilarity('acme corp', 'ACME CORP')).toBe(1.0);
    expect(jaccardSimilarity('Acme Corp', 'ACME CORP')).toBe(1.0);
    expect(jaccardSimilarity('acme corporation', 'ACME Corporation')).toBe(1.0);
  });
});
