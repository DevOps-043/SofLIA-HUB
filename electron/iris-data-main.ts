/**
 * IRIS Data Service for Electron Main Process
 * 
 * This module provides direct access to IRIS (Project Hub) data from the main process,
 * specifically for the WhatsApp agent. It doesn't rely on localStorage or renderer APIs.
 */
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

// ─── IRIS Supabase Client (Main Process) ─────────────────────────────
const IRIS_URL = process.env.VITE_IRIS_SUPABASE_URL || '';
const IRIS_KEY = process.env.VITE_IRIS_SUPABASE_ANON_KEY || '';

let irisSupa: SupabaseClient | null = null;

function getIrisClient(): SupabaseClient | null {
  if (irisSupa) return irisSupa;
  if (!IRIS_URL || !IRIS_KEY) {
    console.warn('[IRIS-Main] No IRIS credentials found in env');
    return null;
  }
  try {
    irisSupa = createClient(IRIS_URL, IRIS_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return irisSupa;
  } catch (err) {
    console.error('[IRIS-Main] Failed to create client:', err);
    return null;
  }
}

// ─── SOFIA Supabase Client (for auth) ────────────────────────────────
const SOFIA_URL = process.env.VITE_SOFIA_SUPABASE_URL || '';
const SOFIA_KEY = process.env.VITE_SOFIA_SUPABASE_ANON_KEY || '';

let sofiaSupa: SupabaseClient | null = null;

function getSofiaClient(): SupabaseClient | null {
  if (sofiaSupa) return sofiaSupa;
  if (!SOFIA_URL || !SOFIA_KEY) {
    console.warn('[SOFIA-Main] No SOFIA credentials found in env');
    return null;
  }
  try {
    sofiaSupa = createClient(SOFIA_URL, SOFIA_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return sofiaSupa;
  } catch (err) {
    console.error('[SOFIA-Main] Failed to create client:', err);
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────────

export interface IrisTeam {
  team_id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  owner_id: string;
}

export interface IrisProject {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description?: string;
  project_status: string;
  health_status: string;
  priority_level: string;
  completion_percentage: number;
  team_id?: string;
  lead_user_id?: string;
  start_date?: string;
  target_date?: string;
}

export interface IrisIssue {
  issue_id: string;
  team_id: string;
  issue_number: number;
  title: string;
  description?: string;
  status_id: string;
  priority_id?: string;
  project_id?: string;
  assignee_id?: string;
  creator_id: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  status?: { name: string; status_type: string; color?: string };
  priority?: { name: string; level: number; color?: string };
}

export interface IrisTeamMember {
  membership_id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

// ─── WhatsApp Session Auth ───────────────────────────────────────────
const WA_AUTH_PATH = path.join(app.getPath('userData'), 'whatsapp-iris-sessions.json');

interface WhatsAppSession {
  phoneNumber: string;
  userId: string;
  email: string;
  fullName: string;
  username: string;
  authenticatedAt: string;
  teamIds: string[];
  autoDetected: boolean; // true = matched by phone, false = manual login
}

let sessions: Map<string, WhatsAppSession> = new Map();

function loadSessions(): void {
  try {
    if (fs.existsSync(WA_AUTH_PATH)) {
      const data = JSON.parse(fs.readFileSync(WA_AUTH_PATH, 'utf-8'));
      sessions = new Map(Object.entries(data));
    }
  } catch {
    sessions = new Map();
  }
}

function saveSessions(): void {
  const obj: Record<string, WhatsAppSession> = {};
  sessions.forEach((v, k) => { obj[k] = v; });
  fs.writeFileSync(WA_AUTH_PATH, JSON.stringify(obj, null, 2), 'utf-8');
}

// Load sessions on startup
loadSessions();

/**
 * Normalize a phone number for comparison.
 * Strips all non-digit chars and removes leading + or country code variations.
 */
function normalizePhone(phone: string): string {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');
  // Remove leading '0' if present (some formats)
  if (digits.startsWith('0')) digits = digits.slice(1);
  // For comparison, take last 10 digits (works for most countries)
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

/**
 * Ensure a user exists in IRIS's `account_users` table by userId alone.
 * Automatically fetches user data from SOFIA if the user doesn't exist in IRIS yet.
 *
 * MUST be called (awaited) BEFORE any INSERT that references account_users via FK
 * (pm_projects.created_by_user_id, task_issues.creator_id, etc.)
 *
 * This is the definitive fix for the FK constraint error — it guarantees the user
 * row exists before any dependent INSERT happens.
 */
async function ensureUserExistsInIris(userId: string): Promise<void> {
  const iris = getIrisClient();
  if (!iris) {
    console.warn('[IRIS-Main] ensureUserExistsInIris: no IRIS client available');
    return;
  }

  try {
    // 1. Quick check — does the user already exist in IRIS?
    const { data: existing } = await iris
      .from('account_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return; // Already synced, nothing to do
    }

    console.log(`[IRIS-Main] User ${userId} NOT found in IRIS account_users — fetching from SOFIA...`);

    // 2. Fetch full user data from SOFIA (the single source of truth)
    const sofia = getSofiaClient();
    if (!sofia) {
      console.error('[IRIS-Main] ensureUserExistsInIris: no SOFIA client — cannot fetch user data');
      return;
    }

    const { data: sofiaUser, error: sofiaError } = await sofia
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
      .eq('id', userId)
      .maybeSingle();

    if (sofiaError || !sofiaUser) {
      console.error(`[IRIS-Main] Could not fetch user ${userId} from SOFIA:`, sofiaError?.message || 'user not found');
      return;
    }

    console.log(`[IRIS-Main] Found SOFIA user: "${sofiaUser.username}" <${sofiaUser.email}> — inserting into IRIS...`);

    // 3. Build IRIS account_users record (matches IRIS schema requirements)
    const lastNameParts = (sofiaUser.last_name || '').trim().split(/\s+/);
    const lastNamePaternal = lastNameParts[0] || sofiaUser.username;
    const lastNameMaternal = lastNameParts.length > 1 ? lastNameParts.slice(1).join(' ') : null;

    const userData = {
      user_id: sofiaUser.id,
      first_name: sofiaUser.first_name || sofiaUser.username,
      last_name_paternal: lastNamePaternal,
      last_name_maternal: lastNameMaternal,
      display_name: sofiaUser.display_name || `${sofiaUser.first_name || ''} ${sofiaUser.last_name || ''}`.trim() || sofiaUser.username,
      username: sofiaUser.username,
      email: sofiaUser.email,
      password_hash: 'SOFIA_MANAGED_AUTH',
      permission_level: 'user',
      account_status: 'active',
      is_email_verified: true,
      phone_number: sofiaUser.phone || null,
      avatar_url: sofiaUser.profile_picture_url || null,
    };

    // 4. Upsert into IRIS (handles race conditions gracefully)
    const { error } = await iris
      .from('account_users')
      .upsert(userData, { onConflict: 'user_id', ignoreDuplicates: true });

    if (error) {
      if (error.code === '23505') {
        // Duplicate — another process already inserted, that's fine
        console.log(`[IRIS-Main] User ${sofiaUser.email} inserted by another process — OK`);
        return;
      }

      if (error.code === '42501' || error.message?.includes('policy')) {
        console.error(`[IRIS-Main] ⚠️ RLS bloquea INSERT en account_users.`);
        console.error(`[IRIS-Main]   Ejecuta en IRIS Supabase SQL Editor:`);
        console.error(`[IRIS-Main]   ALTER TABLE account_users DISABLE ROW LEVEL SECURITY;`);
        console.error(`[IRIS-Main]   O: CREATE POLICY "allow_insert_account_users" ON account_users FOR INSERT WITH CHECK (true);`);
      }

      console.error(`[IRIS-Main] ensureUserExistsInIris INSERT failed (${error.code}): ${error.message}`);
    } else {
      console.log(`[IRIS-Main] ✅ User "${sofiaUser.username}" (${userId}) synced to IRIS account_users`);
    }
  } catch (err: any) {
    console.error(`[IRIS-Main] ensureUserExistsInIris exception:`, err.message);
  }
}

/**
 * Try to automatically authenticate a WhatsApp user by matching their phone number
 * against the SOFIA `users` table. Returns session if found.
 */
export async function tryAutoAuthByPhone(
  senderPhoneNumber: string
): Promise<{ success: boolean; session?: WhatsAppSession; message: string }> {
  // Already authenticated?
  const existing = sessions.get(senderPhoneNumber);
  if (existing) {
    // Sync is now done inside createProject/createIssue (awaited before INSERT)
    // No need to fire-and-forget here — the sync happens at the point of use
    return { success: true, session: existing, message: `Ya autenticado como ${existing.fullName}` };
  }

  const sofia = getSofiaClient();
  if (!sofia) {
    return { success: false, message: 'Sistema de autenticación no disponible.' };
  }

  try {
    const normalizedSender = normalizePhone(senderPhoneNumber);
    console.log(`[IRIS-Main] Auto-auth: looking for phone matching "${senderPhoneNumber}" (normalized: ${normalizedSender})`);

    // Search for user with matching phone in SOFIA users table
    const { data: users, error } = await sofia
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
      .not('phone', 'is', null);

    if (error || !users || users.length === 0) {
      console.log('[IRIS-Main] Auto-auth: no users with phone numbers found');
      return { success: false, message: 'No se encontró un usuario con este número de teléfono.' };
    }

    // Find matching user by normalizing all phones
    const matchedUser = users.find(u => {
      if (!u.phone) return false;
      const userNorm = normalizePhone(u.phone);
      return userNorm === normalizedSender || 
             normalizedSender.endsWith(userNorm) || 
             userNorm.endsWith(normalizedSender);
    });

    if (!matchedUser) {
      console.log(`[IRIS-Main] Auto-auth: no phone match found for ${normalizedSender}`);
      return { success: false, message: 'Tu número de WhatsApp no está registrado en el sistema.' };
    }

    console.log(`[IRIS-Main] Auto-auth: matched user ${matchedUser.username} (${matchedUser.email})`);

    const userId = matchedUser.id;
    const fullName = matchedUser.display_name ||
                     `${matchedUser.first_name || ''} ${matchedUser.last_name || ''}`.trim() ||
                     matchedUser.username;

    // Sync SOFIA user into IRIS account_users (so FK constraints work)
    await ensureUserExistsInIris(matchedUser.id);

    // Fetch IRIS team memberships
    const iris = getIrisClient();
    let teamIds: string[] = [];
    if (iris) {
      try {
        const { data: memberships } = await iris
          .from('team_members')
          .select('team_id')
          .eq('user_id', userId);
        teamIds = (memberships || []).map(m => m.team_id);
      } catch { /* no teams */ }
    }

    // Save session
    const session: WhatsAppSession = {
      phoneNumber: senderPhoneNumber,
      userId,
      email: matchedUser.email,
      fullName,
      username: matchedUser.username,
      authenticatedAt: new Date().toISOString(),
      teamIds,
      autoDetected: true,
    };
    sessions.set(senderPhoneNumber, session);
    saveSessions();

    return {
      success: true,
      session,
      message: `¡Detectado automáticamente! Bienvenido/a, ${fullName}.`,
    };
  } catch (err: any) {
    console.error('[IRIS-Main] Auto-auth error:', err);
    return { success: false, message: `Error al verificar identidad: ${err.message}` };
  }
}

/**
 * Authenticate a WhatsApp user by email/username + password via SOFIA Supabase.
 * This is the FALLBACK method when auto-auth by phone number fails.
 * Uses the SOFIA RPC `authenticate_user` for compatibility with the main app.
 */
export async function authenticateWhatsAppUser(
  phoneNumber: string,
  emailOrUsername: string,
  password: string
): Promise<{ success: boolean; message: string; fullName?: string }> {
  const sofia = getSofiaClient();
  if (!sofia) {
    return { success: false, message: 'El sistema de autenticación no está disponible.' };
  }

  try {
    // Use SOFIA's RPC authenticate_user (same as the main SofLIA app)
    const { data: authResult, error: authError } = await sofia
      .rpc('authenticate_user', {
        p_identifier: emailOrUsername,
        p_password: password,
      });

    if (authError) {
      console.error('[IRIS-Main] authenticate_user RPC error:', authError);
      return { success: false, message: 'Error de conexión con el sistema.' };
    }

    if (!authResult?.success) {
      return { success: false, message: authResult?.error || 'Credenciales inválidas.' };
    }

    const sofiaUser = authResult.user;
    const userId = sofiaUser.id;
    const email = sofiaUser.email || emailOrUsername;
    const fullName = sofiaUser.display_name ||
                     `${sofiaUser.first_name || ''} ${sofiaUser.last_name || ''}`.trim() ||
                     sofiaUser.username || email;

    // Sync SOFIA user into IRIS account_users (so FK constraints work)
    await ensureUserExistsInIris(userId);

    // Fetch IRIS team memberships
    const iris = getIrisClient();
    let teamIds: string[] = [];
    if (iris) {
      try {
        const { data: memberships } = await iris
          .from('team_members')
          .select('team_id')
          .eq('user_id', userId);
        teamIds = (memberships || []).map(m => m.team_id);
      } catch { /* no teams */ }
    }

    // Save session
    const session: WhatsAppSession = {
      phoneNumber,
      userId,
      email,
      fullName,
      username: sofiaUser.username || email,
      authenticatedAt: new Date().toISOString(),
      teamIds,
      autoDetected: false,
    };
    sessions.set(phoneNumber, session);
    saveSessions();

    return { 
      success: true, 
      message: `¡Autenticado exitosamente! Bienvenido/a, ${fullName}.`,
      fullName,
    };
  } catch (err: any) {
    console.error('[IRIS-Main] Auth error:', err);
    return { success: false, message: `Error de autenticación: ${err.message}` };
  }
}

/**
 * Check if a WhatsApp phone number has an active session
 */
export function getWhatsAppSession(phoneNumber: string): WhatsAppSession | null {
  return sessions.get(phoneNumber) || null;
}

/**
 * Logout a WhatsApp user
 */
export function logoutWhatsAppUser(phoneNumber: string): boolean {
  const deleted = sessions.delete(phoneNumber);
  if (deleted) saveSessions();
  return deleted;
}

/**
 * Get all authenticated WhatsApp sessions (for proactive notifications)
 */
export function getAllWhatsAppSessions(): WhatsAppSession[] {
  return Array.from(sessions.values());
}

// ─── IRIS Data Access Functions ──────────────────────────────────────

export function isIrisAvailable(): boolean {
  return !!getIrisClient();
}

export async function getTeams(): Promise<IrisTeam[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    const { data, error } = await iris
      .from('teams')
      .select('*')
      .eq('status', 'active')
      .order('name');
    if (error) {
      // Fallback: try all teams
      const { data: all } = await iris.from('teams').select('*').order('name');
      return all || [];
    }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getTeams error:', err);
    return [];
  }
}

export async function getProjects(teamId?: string): Promise<IrisProject[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    let query = iris
      .from('pm_projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (teamId) query = query.eq('team_id', teamId);
    const { data, error } = await query;
    if (error) { console.error('[IRIS-Main] getProjects error:', error); return []; }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getProjects exception:', err);
    return [];
  }
}

export async function getIssues(filters?: {
  teamId?: string;
  projectId?: string;
  assigneeId?: string;
  limit?: number;
}): Promise<IrisIssue[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    let query = iris
      .from('task_issues')
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (filters?.teamId) query = query.eq('team_id', filters.teamId);
    if (filters?.projectId) query = query.eq('project_id', filters.projectId);
    if (filters?.assigneeId) query = query.eq('assignee_id', filters.assigneeId);
    query = query.limit(filters?.limit || 30);

    const { data, error } = await query;
    if (error) { console.error('[IRIS-Main] getIssues error:', error); return []; }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getIssues exception:', err);
    return [];
  }
}

export async function getTeamMembers(teamId: string): Promise<IrisTeamMember[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    const { data, error } = await iris
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);
    if (error) { console.error('[IRIS-Main] getTeamMembers error:', error); return []; }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getTeamMembers exception:', err);
    return [];
  }
}

// ─── Statuses & Priorities ───────────────────────────────────────────

export async function getStatuses(teamId: string): Promise<{ status_id: string; name: string; status_type: string; color?: string; position: number; is_default: boolean }[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    const { data, error } = await iris
      .from('task_statuses')
      .select('*')
      .eq('team_id', teamId)
      .order('position');
    if (error) { console.error('[IRIS-Main] getStatuses error:', error); return []; }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getStatuses exception:', err);
    return [];
  }
}

export async function getPriorities(): Promise<{ priority_id: string; name: string; level: number; color: string }[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    const { data, error } = await iris
      .from('task_priorities')
      .select('*')
      .order('level');
    if (error) { console.error('[IRIS-Main] getPriorities error:', error); return []; }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getPriorities exception:', err);
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Get the next issue_number for a team (auto-increment).
 * issue_number is NOT auto-generated by the database — it must be set by application code.
 */
async function getNextIssueNumber(teamId: string): Promise<number> {
  const iris = getIrisClient();
  if (!iris) return 1;
  const { data } = await iris
    .from('task_issues')
    .select('issue_number')
    .eq('team_id', teamId)
    .order('issue_number', { ascending: false })
    .limit(1);
  return (data && data.length > 0) ? data[0].issue_number + 1 : 1;
}

// ─── WRITE Operations ────────────────────────────────────────────────

/**
 * Create a new issue/task in IRIS
 */
export async function createIssue(params: {
  teamId: string;
  title: string;
  creatorId: string;
  statusId?: string;
  priorityId?: string;
  projectId?: string;
  assigneeId?: string;
  description?: string;
  dueDate?: string;
}): Promise<{ success: boolean; issue?: any; error?: string }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no está disponible.' };

  try {
    // Ensure creator (and assignee if provided) exist in IRIS before INSERT (FK constraint fix)
    await ensureUserExistsInIris(params.creatorId);
    if (params.assigneeId) {
      await ensureUserExistsInIris(params.assigneeId);
    }

    // If no statusId provided, get the default status for the team
    let statusId = params.statusId;
    if (!statusId) {
      const statuses = await getStatuses(params.teamId);
      const defaultStatus = statuses.find(s => s.is_default) || statuses.find(s => s.status_type === 'backlog') || statuses[0];
      if (defaultStatus) statusId = defaultStatus.status_id;
    }

    if (!statusId) {
      return { success: false, error: 'No se encontró un estado válido para el equipo.' };
    }

    // Auto-generate issue_number (required NOT NULL column, not auto-generated by DB)
    const issueNumber = await getNextIssueNumber(params.teamId);

    const insertData: Record<string, any> = {
      team_id: params.teamId,
      title: params.title,
      creator_id: params.creatorId,
      status_id: statusId,
      issue_number: issueNumber,
    };
    if (params.priorityId) insertData.priority_id = params.priorityId;
    if (params.projectId) insertData.project_id = params.projectId;
    if (params.assigneeId) insertData.assignee_id = params.assigneeId;
    if (params.description) insertData.description = params.description;
    if (params.dueDate) insertData.due_date = params.dueDate;

    const { data, error } = await iris
      .from('task_issues')
      .insert(insertData)
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .single();

    if (error) {
      console.error('[IRIS-Main] createIssue error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[IRIS-Main] Issue created: #${data.issue_number} "${data.title}"`);
    return { success: true, issue: data };
  } catch (err: any) {
    console.error('[IRIS-Main] createIssue exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update the status of an existing issue
 */
export async function updateIssueStatus(params: {
  issueId?: string;
  issueNumber?: number;
  teamId?: string;
  newStatusId?: string;
  newStatusName?: string;
}): Promise<{ success: boolean; issue?: any; error?: string }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no está disponible.' };

  try {
    // Find the issue
    let issueId = params.issueId;
    let teamId = params.teamId;

    if (!issueId && params.issueNumber) {
      let query = iris.from('task_issues').select('issue_id, team_id').eq('issue_number', params.issueNumber);
      if (teamId) query = query.eq('team_id', teamId);
      const { data: found } = await query.limit(1).single();
      if (found) {
        issueId = found.issue_id;
        teamId = found.team_id;
      }
    }

    if (!issueId) return { success: false, error: 'No se encontró la tarea especificada.' };

    // Resolve status
    let statusId = params.newStatusId;
    if (!statusId && params.newStatusName && teamId) {
      const statuses = await getStatuses(teamId);
      const match = statuses.find(s => 
        s.name.toLowerCase() === params.newStatusName!.toLowerCase() ||
        s.status_type.toLowerCase() === params.newStatusName!.toLowerCase()
      );
      if (match) statusId = match.status_id;
    }

    if (!statusId) return { success: false, error: 'No se encontró el estado especificado.' };

    // Build update data
    const updateData: Record<string, any> = {
      status_id: statusId,
      updated_at: new Date().toISOString(),
    };

    // If status is "done" type, set completed_at
    if (teamId) {
      const statuses = await getStatuses(teamId);
      const targetStatus = statuses.find(s => s.status_id === statusId);
      if (targetStatus?.status_type === 'done') {
        updateData.completed_at = new Date().toISOString();
      } else if (targetStatus?.status_type === 'in_progress' || targetStatus?.status_type === 'in_review') {
        if (!updateData.started_at) {
          updateData.started_at = new Date().toISOString();
        }
      }
    }

    const { data, error } = await iris
      .from('task_issues')
      .update(updateData)
      .eq('issue_id', issueId)
      .select('*, status:task_statuses(*), priority:task_priorities(*)')
      .single();

    if (error) {
      console.error('[IRIS-Main] updateIssueStatus error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[IRIS-Main] Issue #${data.issue_number} status updated to "${data.status?.name}"`);
    return { success: true, issue: data };
  } catch (err: any) {
    console.error('[IRIS-Main] updateIssueStatus exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new project in IRIS
 */
export async function createProject(params: {
  projectName: string;
  projectKey: string;
  createdByUserId: string;
  teamId?: string;
  description?: string;
  priorityLevel?: string;
  startDate?: string;
  targetDate?: string;
}): Promise<{ success: boolean; project?: any; error?: string }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no está disponible.' };

  try {
    // Ensure the creator user exists in IRIS before INSERT (FK constraint fix)
    await ensureUserExistsInIris(params.createdByUserId);

    const insertData: Record<string, any> = {
      project_name: params.projectName,
      project_key: params.projectKey.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5),
      created_by_user_id: params.createdByUserId,
      project_status: 'planning',
      health_status: 'none',
      priority_level: params.priorityLevel || 'medium',
      completion_percentage: 0,
      is_public: true,
      is_template: false,
    };
    if (params.teamId) insertData.team_id = params.teamId;
    if (params.description) insertData.project_description = params.description;
    if (params.startDate) insertData.start_date = params.startDate;
    if (params.targetDate) insertData.target_date = params.targetDate;

    const { data, error } = await iris
      .from('pm_projects')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      console.error('[IRIS-Main] createProject error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[IRIS-Main] Project created: "${data.project_name}" [${data.project_key}]`);
    return { success: true, project: data };
  } catch (err: any) {
    console.error('[IRIS-Main] createProject exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update the status of an existing project
 */
export async function updateProjectStatus(params: {
  projectId: string;
  newStatus: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
}): Promise<{ success: boolean; project?: any; error?: string }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no está disponible.' };

  try {
    const updateData: Record<string, any> = {
      project_status: params.newStatus,
      updated_at: new Date().toISOString(),
    };

    if (params.newStatus === 'completed') {
      updateData.actual_end_date = new Date().toISOString().split('T')[0];
      updateData.completion_percentage = 100;
    } else if (params.newStatus === 'archived') {
      updateData.archived_at = new Date().toISOString();
    }

    const { data, error } = await iris
      .from('pm_projects')
      .update(updateData)
      .eq('project_id', params.projectId)
      .select('*')
      .single();

    if (error) {
      console.error('[IRIS-Main] updateProjectStatus error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[IRIS-Main] Project "${data.project_name}" status updated to "${params.newStatus}"`);
    return { success: true, project: data };
  } catch (err: any) {
    console.error('[IRIS-Main] updateProjectStatus exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Build a full IRIS context string for the WhatsApp agent prompt.
 * If a userId is provided (authenticated user), includes their assigned issues.
 */
export async function buildIrisContextForWhatsApp(userId?: string): Promise<string> {
  const iris = getIrisClient();
  if (!iris) return '';

  try {
    const parts: string[] = ['=== DATOS DE IRIS (Project Hub) ==='];

    const teams = await getTeams();
    if (teams.length > 0) {
      parts.push('\n## Equipos:');
      for (const team of teams.slice(0, 5)) {
        parts.push(`- ${team.name} (${team.slug}) | Estado: ${team.status} | ID: ${team.team_id}`);
      }
    }

    const projects = await getProjects();
    if (projects.length > 0) {
      parts.push('\n## Proyectos:');
      for (const proj of projects.slice(0, 10)) {
        parts.push(`- ${proj.project_name} [${proj.project_key}] | Estado: ${proj.project_status} | Progreso: ${proj.completion_percentage}% | Prioridad: ${proj.priority_level} | ID: ${proj.project_id}`);
      }
    }

    // If user is authenticated, show THEIR assigned issues
    if (userId) {
      const myIssues = await getIssues({ assigneeId: userId, limit: 20 });
      if (myIssues.length > 0) {
        parts.push('\n## Mis tareas asignadas:');
        for (const issue of myIssues) {
          const statusName = issue.status?.name || 'Sin estado';
          const priorityName = issue.priority?.name || 'Sin prioridad';
          const dueStr = issue.due_date ? ` | Vence: ${issue.due_date}` : '';
          parts.push(`- #${issue.issue_number} ${issue.title} | Estado: ${statusName} | Prioridad: ${priorityName}${dueStr}`);
        }
      }
    }

    // General issues by team
    if (teams.length > 0) {
      let totalIssues = 0;
      for (const team of teams.slice(0, 3)) {
        if (totalIssues >= 30) break;
        const issues = await getIssues({ teamId: team.team_id, limit: Math.min(15, 30 - totalIssues) });
        if (issues.length > 0) {
          parts.push(`\n## Issues (equipo: ${team.name}):`);
          for (const issue of issues) {
            const statusName = issue.status?.name || 'Sin estado';
            const priorityName = issue.priority?.name || 'Sin prioridad';
            const assigneeStr = issue.assignee_id ? ` | Asignado: ${issue.assignee_id}` : ' | Sin asignar';
            parts.push(`- #${issue.issue_number} ${issue.title} | Estado: ${statusName} | Prioridad: ${priorityName}${assigneeStr}`);
            totalIssues++;
          }
        }
      }
    }

    if (parts.length <= 1) return '';
    parts.push('\n=== FIN DATOS IRIS ===');
    return parts.join('\n');
  } catch (err) {
    console.error('[IRIS-Main] buildIrisContext error:', err);
    return '';
  }
}

// ─── Keywords for IRIS query detection ───────────────────────────────
const IRIS_KEYWORDS = [
  'proyecto', 'proyectos', 'project', 'projects',
  'issue', 'issues', 'tarea', 'tareas', 'task', 'tasks',
  'equipo', 'equipos', 'team', 'teams',
  'sprint', 'ciclo', 'cycle',
  'pendiente', 'pendientes',
  'estado de', 'status',
  'prioridad', 'priority',
  'asignar', 'assignee', 'asignadas', 'asignado',
  'backlog', 'kanban',
  'project hub', 'iris',
  'crear proyecto', 'crear tarea', 'create project', 'create task',
  'actualizar', 'update',
  'mis tareas', 'my tasks',
  'avance', 'progreso', 'progress',
  'login', 'inicio de sesion', 'iniciar sesion', 'iniciar sesión',
  'cerrar sesion', 'cerrar sesión', 'logout',
  'autenticar', 'authenticate',
];

export function needsIrisData(message: string): boolean {
  const lower = message.toLowerCase();
  return IRIS_KEYWORDS.some(kw => lower.includes(kw));
}
