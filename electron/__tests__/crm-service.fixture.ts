export interface CRMCompany {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  created_at?: string;
}

export interface CRMContact {
  id: string;
  name: string;
  email?: string;
  company_id: string;
}

export interface CRMOpportunity {
  id: string;
  title: string;
  company_id: string;
  status: 'open' | 'won' | 'lost';
  value?: number;
}

export function bigrams(str: string): Set<string> {
  const normalized = str.toLowerCase().trim();
  if (normalized.length < 2) return new Set(normalized.length === 1 ? [normalized] : []);
  const result = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    result.add(normalized.substring(i, i + 2));
  }
  return result;
}

export function jaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export class MockCRMStore {
  companies: CRMCompany[] = [];
  contacts: CRMContact[] = [];
  opportunities: CRMOpportunity[] = [];
  private nextId = 1;

  createCompany(name: string, opts?: Partial<CRMCompany>): CRMCompany {
    const company = { id: `comp-${this.nextId++}`, name, ...opts, created_at: new Date().toISOString() };
    this.companies.push(company);
    return company;
  }

  findSimilarCompany(name: string, threshold = 0.5): CRMCompany | null {
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

  updateOpportunityStatus(id: string, status: 'open' | 'won' | 'lost'): CRMOpportunity | null {
    const opportunity = this.opportunities.find((item) => item.id === id);
    if (opportunity) opportunity.status = status;
    return opportunity || null;
  }
}
