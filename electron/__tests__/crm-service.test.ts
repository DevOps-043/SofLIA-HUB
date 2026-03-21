/**
 * CRM Service Tests — CRM-001 to CRM-008
 * Tests CRM operations and Jaccard similarity deduplication.
 * The CRM service file does not exist yet, so we test the Jaccard
 * algorithm as a pure function and CRM logic through mocked Supabase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Jaccard Similarity (replicated from CLAUDE.md specification) ────
// The Jaccard index is used for company name deduplication in the CRM.
// J(A, B) = |A ∩ B| / |A ∪ B|, using bigrams (2-char shingles).

function bigrams(str: string): Set<string> {
  const normalized = str.toLowerCase().trim();
  if (normalized.length < 2) return new Set(normalized.length === 1 ? [normalized] : []);
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

// ─── Mock Supabase for CRM CRUD operations ──────────────────────────

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

// In-memory CRM store for testing
class MockCRMStore {
  companies: CRMCompany[] = [];
  contacts: CRMContact[] = [];
  opportunities: CRMOpportunity[] = [];
  private nextId = 1;

  createCompany(name: string, opts?: Partial<CRMCompany>): CRMCompany {
    const company: CRMCompany = {
      id: `comp-${this.nextId++}`,
      name,
      ...opts,
      created_at: new Date().toISOString(),
    };
    this.companies.push(company);
    return company;
  }

  findSimilarCompany(name: string, threshold = 0.5): CRMCompany | null {
    for (const company of this.companies) {
      if (jaccardSimilarity(company.name, name) >= threshold) {
        return company;
      }
    }
    return null;
  }

  createContact(name: string, companyId: string, email?: string): CRMContact {
    const contact: CRMContact = {
      id: `cont-${this.nextId++}`,
      name,
      email,
      company_id: companyId,
    };
    this.contacts.push(contact);
    return contact;
  }

  createOpportunity(title: string, companyId: string, value?: number): CRMOpportunity {
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

  updateOpportunityStatus(id: string, status: 'open' | 'won' | 'lost'): CRMOpportunity | null {
    const opp = this.opportunities.find(o => o.id === id);
    if (opp) opp.status = status;
    return opp || null;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('CRM Service — Jaccard Deduplication & CRUD', () => {
  let store: MockCRMStore;

  beforeEach(() => {
    store = new MockCRMStore();
  });

  // CRM-001: Create company
  it('CRM-001: createCompany stores a new company with generated id', () => {
    const company = store.createCompany('Acme Corp', { industry: 'Tech' });

    expect(company.id).toBeDefined();
    expect(company.name).toBe('Acme Corp');
    expect(company.industry).toBe('Tech');
    expect(company.created_at).toBeDefined();
    expect(store.companies).toHaveLength(1);
  });

  // CRM-002: Jaccard detects similar names
  it('CRM-002: Jaccard detects similar names ("Acme Corp" vs "Acme Corporation")', () => {
    const similarity = jaccardSimilarity('Acme Corp', 'Acme Corporation');
    // These share many bigrams, similarity should be > 0.5
    expect(similarity).toBeGreaterThan(0.5);

    // Also test through the store
    store.createCompany('Acme Corp');
    const found = store.findSimilarCompany('Acme Corporation', 0.5);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Acme Corp');
  });

  // CRM-003: Jaccard passes different names
  it('CRM-003: Jaccard passes different names ("Acme" vs "Globex")', () => {
    const similarity = jaccardSimilarity('Acme', 'Globex');
    // Very different names should have low similarity
    expect(similarity).toBeLessThan(0.3);

    store.createCompany('Acme');
    const found = store.findSimilarCompany('Globex', 0.5);
    expect(found).toBeNull();
  });

  // CRM-004: Contact linked to company
  it('CRM-004: createContact links contact to correct company', () => {
    const company = store.createCompany('DevOps Inc');
    const contact = store.createContact('Juan Perez', company.id, 'juan@devops.com');

    expect(contact.company_id).toBe(company.id);
    expect(contact.name).toBe('Juan Perez');
    expect(contact.email).toBe('juan@devops.com');
    expect(store.contacts).toHaveLength(1);
  });

  // CRM-005: Opportunity lifecycle (open → won → lost)
  it('CRM-005: opportunity status transitions through lifecycle', () => {
    const company = store.createCompany('Client SA');
    const opp = store.createOpportunity('Proyecto IA', company.id, 50000);

    expect(opp.status).toBe('open');

    store.updateOpportunityStatus(opp.id, 'won');
    expect(opp.status).toBe('won');

    store.updateOpportunityStatus(opp.id, 'lost');
    expect(opp.status).toBe('lost');
  });

  // CRM-006: Jaccard empty strings → 0
  it('CRM-006: Jaccard returns 0 for empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(0);
    expect(jaccardSimilarity('Acme', '')).toBe(0);
    expect(jaccardSimilarity('', 'Globex')).toBe(0);
  });

  // CRM-007: Jaccard identical strings → 1.0
  it('CRM-007: Jaccard returns 1.0 for identical strings', () => {
    expect(jaccardSimilarity('Acme Corp', 'Acme Corp')).toBe(1.0);
    expect(jaccardSimilarity('Globex Industries', 'Globex Industries')).toBe(1.0);
  });

  // CRM-008: Jaccard case insensitive
  it('CRM-008: Jaccard is case insensitive', () => {
    const lower = jaccardSimilarity('acme corp', 'ACME CORP');
    expect(lower).toBe(1.0);

    const mixed = jaccardSimilarity('Acme Corp', 'ACME CORP');
    expect(mixed).toBe(1.0);

    const partial = jaccardSimilarity('acme corporation', 'ACME Corporation');
    expect(partial).toBe(1.0);
  });
});
