/**
 * CRM-lite Service — Prospect/Company/Opportunity Management
 *
 * Provides CRUD + deduplication for CRM entities.
 * Follows the same pattern as iris-data-main.ts (uses IRIS Supabase client).
 */
import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';
import { app } from 'electron';
import fs from 'node:fs';

// Load .env from project root
const envPath = path.join(app.getAppPath(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// ─── Types ───────────────────────────────────────────────────────────

export interface CRMCompany {
  company_id: string;
  organization_id: string | null;
  name: string;
  domain: string | null;
  industry: string | null;
  size_range: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  contact_id: string;
  company_id: string | null;
  organization_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_title: string | null;
  linkedin_url: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CRMOpportunity {
  opportunity_id: string;
  company_id: string | null;
  contact_id: string | null;
  organization_id: string | null;
  title: string;
  stage: string;
  estimated_value: number | null;
  currency: string;
  close_date: string | null;
  pains: string[];
  objections: string[];
  next_step: string | null;
  owner_id: string | null;
  lost_reason: string | null;
  won_reason: string | null;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CRMInteraction {
  interaction_id: string;
  opportunity_id: string | null;
  contact_id: string | null;
  organization_id: string | null;
  interaction_type: string;
  channel: string | null;
  raw_input: string | null;
  ai_summary: string | null;
  extracted_data: Record<string, any>;
  trace_id: string;
  source_ref: string | null;
  created_by: string;
  created_at: string;
}

export type OpportunityStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

// ─── IRIS Supabase Client ────────────────────────────────────────────

const IRIS_URL = process.env.VITE_IRIS_SUPABASE_URL || '';
const IRIS_KEY = process.env.VITE_IRIS_SUPABASE_ANON_KEY || '';

let irisClient: SupabaseClient | null = null;

function getIrisClient(): SupabaseClient | null {
  if (irisClient) return irisClient;
  if (!IRIS_URL || !IRIS_KEY) {
    console.warn('[CRMService] No IRIS credentials found in env');
    return null;
  }
  try {
    irisClient = createClient(IRIS_URL, IRIS_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return irisClient;
  } catch (err) {
    console.error('[CRMService] Failed to create IRIS client:', err);
    return null;
  }
}

// ─── Helper: Simple string similarity ────────────────────────────────

function similarity(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1.0;
  if (al.includes(bl) || bl.includes(al)) return 0.8;

  // Jaccard on words
  const wordsA = new Set(al.split(/\s+/));
  const wordsB = new Set(bl.split(/\s+/));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// ─── CRM Service Class ──────────────────────────────────────────────

export class CRMService extends EventEmitter {

  constructor() {
    super();
    console.log('[CRMService] Initialized');
  }

  // ─── Companies ───────────────────────────────────────────────────

  async findOrCreateCompany(params: {
    name: string;
    domain?: string;
    industry?: string;
    sizeRange?: string;
    organizationId?: string;
    createdBy: string;
  }): Promise<{
    company: CRMCompany;
    created: boolean;
    duplicateCandidates?: CRMCompany[];
  }> {
    const iris = getIrisClient();
    if (!iris) throw new Error('IRIS no disponible');

    // Search for duplicates
    const duplicates = await this.findDuplicateCompanies(params.name, params.domain, params.organizationId);

    if (duplicates.length > 0) {
      // Exact name match → return existing
      const exactMatch = duplicates.find(d =>
        d.name.toLowerCase().trim() === params.name.toLowerCase().trim()
      );
      if (exactMatch) {
        return { company: exactMatch, created: false };
      }
      // Near match → return candidates for HITL
      return { company: duplicates[0], created: false, duplicateCandidates: duplicates };
    }

    // Create new
    const { data, error } = await iris
      .from('crm_companies')
      .insert({
        name: params.name,
        domain: params.domain || null,
        industry: params.industry || null,
        size_range: params.sizeRange || null,
        organization_id: params.organizationId || null,
        created_by: params.createdBy,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] createCompany error:', error);
      throw new Error(error?.message || 'Error creando empresa');
    }

    console.log(`[CRMService] Company created: ${data.name} (${data.company_id})`);
    this.emit('company:created', data);
    return { company: data as CRMCompany, created: true };
  }

  async findDuplicateCompanies(name: string, domain?: string, organizationId?: string): Promise<CRMCompany[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    try {
      let query = iris.from('crm_companies').select('*');
      if (organizationId) query = query.eq('organization_id', organizationId);

      const { data } = await query;
      if (!data) return [];

      const candidates = data.filter(c => {
        const nameSim = similarity(c.name, name);
        const domainMatch = domain && c.domain && c.domain.toLowerCase() === domain.toLowerCase();
        return nameSim >= 0.6 || domainMatch;
      });

      // Sort by similarity
      candidates.sort((a, b) => similarity(b.name, name) - similarity(a.name, name));
      return candidates as CRMCompany[];
    } catch (err) {
      console.error('[CRMService] findDuplicateCompanies error:', err);
      return [];
    }
  }

  async getCompany(companyId: string): Promise<CRMCompany | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data } = await iris
      .from('crm_companies')
      .select('*')
      .eq('company_id', companyId)
      .single();

    return data as CRMCompany | null;
  }

  async updateCompany(companyId: string, updates: Partial<CRMCompany>): Promise<CRMCompany | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { company_id, created_at, created_by, ...safeUpdates } = updates as any;

    const { data, error } = await iris
      .from('crm_companies')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] updateCompany error:', error);
      return null;
    }

    console.log(`[CRMService] Company updated: ${companyId}`);
    this.emit('company:updated', data);
    return data as CRMCompany;
  }

  async getCompanyWithContacts(companyId: string): Promise<{
    company: CRMCompany;
    contacts: CRMContact[];
    opportunities: CRMOpportunity[];
  } | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const [companyRes, contactsRes, oppsRes] = await Promise.all([
      iris.from('crm_companies').select('*').eq('company_id', companyId).single(),
      iris.from('crm_contacts').select('*').eq('company_id', companyId).order('created_at'),
      iris.from('crm_opportunities').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    ]);

    if (!companyRes.data) return null;

    return {
      company: companyRes.data as CRMCompany,
      contacts: (contactsRes.data || []) as CRMContact[],
      opportunities: (oppsRes.data || []) as CRMOpportunity[],
    };
  }

  // ─── Contacts ────────────────────────────────────────────────────

  async findOrCreateContact(params: {
    fullName: string;
    email?: string;
    phone?: string;
    roleTitle?: string;
    companyId?: string;
    organizationId?: string;
    createdBy: string;
  }): Promise<{
    contact: CRMContact;
    created: boolean;
    duplicateCandidates?: CRMContact[];
  }> {
    const iris = getIrisClient();
    if (!iris) throw new Error('IRIS no disponible');

    const duplicates = await this.findDuplicateContacts(
      params.fullName, params.email, params.phone, params.organizationId
    );

    if (duplicates.length > 0) {
      // Exact email/phone match
      const exactMatch = duplicates.find(d =>
        (params.email && d.email?.toLowerCase() === params.email.toLowerCase()) ||
        (params.phone && d.phone === params.phone)
      );
      if (exactMatch) {
        return { contact: exactMatch, created: false };
      }
      // Near name match
      const nameMatch = duplicates.find(d =>
        d.full_name.toLowerCase().trim() === params.fullName.toLowerCase().trim()
      );
      if (nameMatch) {
        return { contact: nameMatch, created: false };
      }
      return { contact: duplicates[0], created: false, duplicateCandidates: duplicates };
    }

    const { data, error } = await iris
      .from('crm_contacts')
      .insert({
        full_name: params.fullName,
        email: params.email || null,
        phone: params.phone || null,
        role_title: params.roleTitle || null,
        company_id: params.companyId || null,
        organization_id: params.organizationId || null,
        created_by: params.createdBy,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] createContact error:', error);
      throw new Error(error?.message || 'Error creando contacto');
    }

    console.log(`[CRMService] Contact created: ${data.full_name} (${data.contact_id})`);
    this.emit('contact:created', data);
    return { contact: data as CRMContact, created: true };
  }

  async getContact(contactId: string): Promise<CRMContact | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data, error } = await iris
      .from('crm_contacts')
      .select('*')
      .eq('contact_id', contactId)
      .single();

    if (error || !data) {
      console.error('[CRMService] getContact error:', error);
      return null;
    }

    return data as CRMContact;
  }

  async updateContact(contactId: string, updates: Partial<CRMContact>): Promise<CRMContact | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { contact_id, created_at, created_by, ...safeUpdates } = updates as any;

    const { data, error } = await iris
      .from('crm_contacts')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('contact_id', contactId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] updateContact error:', error);
      return null;
    }

    console.log(`[CRMService] Contact updated: ${contactId}`);
    this.emit('contact:updated', data);
    return data as CRMContact;
  }

  async findDuplicateContacts(name: string, email?: string, phone?: string, organizationId?: string): Promise<CRMContact[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    try {
      let query = iris.from('crm_contacts').select('*');
      if (organizationId) query = query.eq('organization_id', organizationId);

      const { data } = await query;
      if (!data) return [];

      const candidates = data.filter(c => {
        const nameSim = similarity(c.full_name, name);
        const emailMatch = email && c.email && c.email.toLowerCase() === email.toLowerCase();
        const phoneMatch = phone && c.phone && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '');
        return nameSim >= 0.7 || emailMatch || phoneMatch;
      });

      candidates.sort((a, b) => similarity(b.full_name, name) - similarity(a.full_name, name));
      return candidates as CRMContact[];
    } catch (err) {
      console.error('[CRMService] findDuplicateContacts error:', err);
      return [];
    }
  }

  async searchContacts(query: string, organizationId?: string): Promise<CRMContact[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    try {
      let dbQuery = iris
        .from('crm_contacts')
        .select('*')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (organizationId) dbQuery = dbQuery.eq('organization_id', organizationId);

      const { data } = await dbQuery;
      return (data || []) as CRMContact[];
    } catch (err) {
      console.error('[CRMService] searchContacts error:', err);
      return [];
    }
  }

  // ─── Opportunities ───────────────────────────────────────────────

  async createOpportunity(params: {
    title: string;
    companyId?: string;
    contactId?: string;
    organizationId?: string;
    stage?: OpportunityStage;
    estimatedValue?: number;
    currency?: string;
    pains?: string[];
    objections?: string[];
    nextStep?: string;
    ownerId?: string;
    createdBy: string;
  }): Promise<CRMOpportunity> {
    const iris = getIrisClient();
    if (!iris) throw new Error('IRIS no disponible');

    const { data, error } = await iris
      .from('crm_opportunities')
      .insert({
        title: params.title,
        company_id: params.companyId || null,
        contact_id: params.contactId || null,
        organization_id: params.organizationId || null,
        stage: params.stage || 'lead',
        estimated_value: params.estimatedValue || null,
        currency: params.currency || 'MXN',
        pains: params.pains || [],
        objections: params.objections || [],
        next_step: params.nextStep || null,
        owner_id: params.ownerId || params.createdBy,
        created_by: params.createdBy,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] createOpportunity error:', error);
      throw new Error(error?.message || 'Error creando oportunidad');
    }

    console.log(`[CRMService] Opportunity created: ${data.title} (${data.opportunity_id})`);
    this.emit('opportunity:created', data);
    return data as CRMOpportunity;
  }

  async updateOpportunity(opportunityId: string, updates: Partial<CRMOpportunity>): Promise<CRMOpportunity | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { opportunity_id, created_at, created_by, ...safeUpdates } = updates as any;

    const { data, error } = await iris
      .from('crm_opportunities')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('opportunity_id', opportunityId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] updateOpportunity error:', error);
      return null;
    }

    console.log(`[CRMService] Opportunity updated: ${opportunityId}`);
    this.emit('opportunity:updated', data);
    return data as CRMOpportunity;
  }

  async updateOpportunityStage(
    opportunityId: string,
    stage: OpportunityStage,
    reason?: string
  ): Promise<CRMOpportunity | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const updateData: Record<string, any> = {
      stage,
      updated_at: new Date().toISOString(),
    };

    if (stage === 'won') updateData.won_reason = reason || null;
    if (stage === 'lost') updateData.lost_reason = reason || null;

    const { data, error } = await iris
      .from('crm_opportunities')
      .update(updateData)
      .eq('opportunity_id', opportunityId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] updateOpportunityStage error:', error);
      return null;
    }

    console.log(`[CRMService] Opportunity ${opportunityId} → stage: ${stage}`);
    this.emit('opportunity:updated', data);
    return data as CRMOpportunity;
  }

  async deleteOpportunity(opportunityId: string): Promise<boolean> {
    const iris = getIrisClient();
    if (!iris) return false;

    const { error } = await iris
      .from('crm_opportunities')
      .delete()
      .eq('opportunity_id', opportunityId);

    if (error) {
      console.error('[CRMService] deleteOpportunity error:', error);
      return false;
    }

    console.log(`[CRMService] Opportunity deleted: ${opportunityId}`);
    this.emit('opportunity:deleted', opportunityId);
    return true;
  }

  async getOpportunities(filters?: {
    organizationId?: string;
    stage?: string;
    ownerId?: string;
    limit?: number;
  }): Promise<CRMOpportunity[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    try {
      let query = iris
        .from('crm_opportunities')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(filters?.limit || 50);

      if (filters?.organizationId) query = query.eq('organization_id', filters.organizationId);
      if (filters?.stage) query = query.eq('stage', filters.stage);
      if (filters?.ownerId) query = query.eq('owner_id', filters.ownerId);

      const { data } = await query;
      return (data || []) as CRMOpportunity[];
    } catch (err) {
      console.error('[CRMService] getOpportunities error:', err);
      return [];
    }
  }

  // ─── Pipeline Summary ────────────────────────────────────────────

  async getPipelineSummary(organizationId?: string): Promise<Record<string, number>> {
    const iris = getIrisClient();
    if (!iris) return {};

    try {
      let query = iris.from('crm_opportunities').select('stage');
      if (organizationId) query = query.eq('organization_id', organizationId);

      const { data } = await query;
      if (!data) return {};

      const pipeline: Record<string, number> = {};
      for (const opp of data) {
        pipeline[opp.stage] = (pipeline[opp.stage] || 0) + 1;
      }
      return pipeline;
    } catch (err) {
      console.error('[CRMService] getPipelineSummary error:', err);
      return {};
    }
  }

  // ─── Interactions ────────────────────────────────────────────────

  async logInteraction(params: {
    opportunityId?: string;
    contactId?: string;
    organizationId?: string;
    interactionType: string;
    channel?: string;
    rawInput?: string;
    aiSummary?: string;
    extractedData?: Record<string, any>;
    traceId: string;
    sourceRef?: string;
    createdBy: string;
  }): Promise<CRMInteraction | null> {
    const iris = getIrisClient();
    if (!iris) return null;

    const { data, error } = await iris
      .from('crm_interactions')
      .insert({
        opportunity_id: params.opportunityId || null,
        contact_id: params.contactId || null,
        organization_id: params.organizationId || null,
        interaction_type: params.interactionType,
        channel: params.channel || null,
        raw_input: params.rawInput || null,
        ai_summary: params.aiSummary || null,
        extracted_data: params.extractedData || {},
        trace_id: params.traceId,
        source_ref: params.sourceRef || null,
        created_by: params.createdBy,
      })
      .select('*')
      .single();

    if (error || !data) {
      console.error('[CRMService] logInteraction error:', error);
      return null;
    }

    console.log(`[CRMService] Interaction logged: ${data.interaction_type} (trace: ${data.trace_id})`);
    return data as CRMInteraction;
  }

  async getInteractions(filters?: {
    opportunityId?: string;
    contactId?: string;
    traceId?: string;
    limit?: number;
  }): Promise<CRMInteraction[]> {
    const iris = getIrisClient();
    if (!iris) return [];

    try {
      let query = iris
        .from('crm_interactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50);

      if (filters?.opportunityId) query = query.eq('opportunity_id', filters.opportunityId);
      if (filters?.contactId) query = query.eq('contact_id', filters.contactId);
      if (filters?.traceId) query = query.eq('trace_id', filters.traceId);

      const { data } = await query;
      return (data || []) as CRMInteraction[];
    } catch (err) {
      console.error('[CRMService] getInteractions error:', err);
      return [];
    }
  }
}
