// ---------------------------------------------------------------------------
// crm-renderer-service.ts
// Typed wrapper around the window.crm API exposed by Electron preload.
// All calls go through IPC via the preload bridge.
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export interface CRMCompany {
  company_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  contact_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CRMOpportunity {
  opportunity_id: string;
  company_id: string | null;
  contact_id: string | null;
  pipeline_id: string;
  stage_id: string;
  name: string;
  value: number | null;
  currency: string;
  probability: number | null;
  expected_close_date: string | null;
  owner_id: string;
  status: string;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CRMInteraction {
  interaction_id: string;
  contact_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  type: string;
  channel: string | null;
  subject: string | null;
  body: string | null;
  direction: string | null;
  logged_by: string;
  occurred_at: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CRMPipeline {
  pipeline_id: string;
  name: string;
  stages: CRMPipelineStage[];
  created_at: string;
  updated_at: string;
}

export interface CRMPipelineStage {
  stage_id: string;
  pipeline_id: string;
  name: string;
  order: number;
  probability: number | null;
}

// ---- Internal helper ------------------------------------------------------

function getCRMAPI(): Record<string, (...args: any[]) => Promise<any>> | null {
  const api = (window as any).crm;
  if (api && typeof api === 'object') {
    return api;
  }
  return null;
}

const NOT_AVAILABLE = { success: false as const, error: 'API no disponible' };

// ---- Public functions -----------------------------------------------------

/**
 * Check whether the CRM preload API is exposed in the current context.
 */
export function isCRMAvailable(): boolean {
  return getCRMAPI() !== null;
}

/**
 * Retrieve opportunities with optional filters.
 */
export async function getOpportunities(
  filters?: {
    companyId?: string;
    contactId?: string;
    pipelineId?: string;
    stageId?: string;
    status?: string;
    ownerId?: string;
    limit?: number;
  },
): Promise<{ success: boolean; opportunities?: CRMOpportunity[]; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.getOpportunities(filters);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Fetch a single company by its ID.
 */
export async function getCompany(
  companyId: string,
): Promise<{ success: boolean; company?: CRMCompany; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.getCompany(companyId);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Search contacts by query string (name, email, etc.).
 */
export async function searchContacts(
  query: string,
  filters?: {
    companyId?: string;
    tags?: string[];
    limit?: number;
  },
): Promise<{ success: boolean; contacts?: CRMContact[]; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.searchContacts(query, filters);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Move an opportunity to a different pipeline stage.
 */
export async function updateOpportunityStage(
  opportunityId: string,
  stageId: string,
  reason?: string,
): Promise<{ success: boolean; opportunity?: CRMOpportunity; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.updateOpportunityStage(opportunityId, stageId, reason);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Log a new interaction (call, email, meeting, note, etc.).
 */
export async function logInteraction(params: {
  contactId?: string;
  companyId?: string;
  opportunityId?: string;
  type: string;
  channel?: string;
  subject?: string;
  body?: string;
  direction?: string;
  loggedBy: string;
  occurredAt?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; interaction?: CRMInteraction; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.logInteraction(params);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Retrieve a pipeline and its stages.
 */
export async function getPipeline(
  pipelineId: string,
): Promise<{ success: boolean; pipeline?: CRMPipeline; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.getPipeline(pipelineId);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Find an existing company by domain/name or create a new one.
 */
export async function findOrCreateCompany(params: {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  country?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  linkedinUrl?: string;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}): Promise<{ success: boolean; company?: CRMCompany; created?: boolean; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.findOrCreateCompany(params);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Find an existing contact by email or create a new one.
 */
export async function findOrCreateContact(params: {
  firstName: string;
  lastName: string;
  email?: string;
  companyId?: string;
  phone?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}): Promise<{ success: boolean; contact?: CRMContact; created?: boolean; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.findOrCreateContact(params);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

/**
 * Create a new opportunity in a pipeline.
 */
export async function createOpportunity(params: {
  name: string;
  pipelineId: string;
  stageId: string;
  ownerId: string;
  companyId?: string;
  contactId?: string;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}): Promise<{ success: boolean; opportunity?: CRMOpportunity; error?: string }> {
  const api = getCRMAPI();
  if (!api) return NOT_AVAILABLE;

  try {
    return await api.createOpportunity(params);
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}
