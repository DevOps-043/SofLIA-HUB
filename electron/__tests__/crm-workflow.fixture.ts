import { vi } from 'vitest';

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

function bigrams(str: string): Set<string> {
  const normalized = str.toLowerCase().trim();
  if (normalized.length < 2) return new Set(normalized.length === 1 ? [normalized] : []);
  return new Set(Array.from({ length: normalized.length - 1 }, (_, index) => normalized.substring(index, index + 2)));
}

function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export class MockCRMStore {
  companies: CRMCompany[] = [];
  contacts: CRMContact[] = [];
  opportunities: CRMOpportunity[] = [];
  private nextId = 1;

  createCompany(name: string, opts?: Partial<CRMCompany>): CRMCompany {
    const existing = this.findSimilarCompany(name);
    if (existing) throw new Error(`Empresa duplicada detectada: "${existing.name}" (Jaccard >= 0.7)`);
    return this.forceCreateCompany(name, opts);
  }

  forceCreateCompany(name: string, opts?: Partial<CRMCompany>): CRMCompany {
    const company = { id: `comp-${this.nextId++}`, name, ...opts, created_at: new Date().toISOString() };
    this.companies.push(company);
    return company;
  }

  findSimilarCompany(name: string, threshold = 0.7): CRMCompany | null {
    return this.companies.find((company) => jaccardSimilarity(company.name, name) >= threshold) || null;
  }

  createContact(name: string, companyId: string, email?: string): CRMContact {
    const contact = { id: `cont-${this.nextId++}`, name, email, company_id: companyId };
    this.contacts.push(contact);
    return contact;
  }

  createOpportunity(title: string, companyId: string, value?: number): CRMOpportunity {
    const opportunity = { id: `opp-${this.nextId++}`, title, company_id: companyId, status: 'open' as const, value };
    this.opportunities.push(opportunity);
    return opportunity;
  }
}

export const mockGeminiExtract = vi.fn(async (text: string): Promise<{ company: string | null; email: string | null }> => {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const companyMatch = text.match(/empresa\s+(\S+)/i);
  return { company: companyMatch ? companyMatch[1] : null, email: emailMatch ? emailMatch[0] : null };
});
