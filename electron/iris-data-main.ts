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
import {
  describeResolutionCandidates,
  generateUniqueProjectKey,
  normalizeProjectKey,
  resolveSearchCandidate,
} from '../src/shared/iris-resolution';
// Load .env from project root
const envPath = path.join(app.getAppPath(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// â”€â”€â”€ IRIS Supabase Client (Main Process) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ SOFIA Supabase Client (for auth) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  member_id: string;
  membership_id?: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface IrisTeamMemberDetail extends IrisTeamMember {
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

// â”€â”€â”€ WhatsApp Session Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
 * This is the definitive fix for the FK constraint error â€” it guarantees the user
 * row exists before any dependent INSERT happens.
 */
async function ensureUserExistsInIris(userId: string): Promise<void> {
  const iris = getIrisClient();
  if (!iris) {
    console.warn('[IRIS-Main] ensureUserExistsInIris: no IRIS client available');
    return;
  }

  try {
    // 1. Quick check â€” does the user already exist in IRIS?
    const { data: existing } = await iris
      .from('account_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return; // Already synced, nothing to do
    }

    console.log(`[IRIS-Main] User ${userId} NOT found in IRIS account_users â€” fetching from SOFIA...`);

    // 2. Fetch full user data from SOFIA (the single source of truth)
    const sofia = getSofiaClient();
    if (!sofia) {
      console.error('[IRIS-Main] ensureUserExistsInIris: no SOFIA client â€” cannot fetch user data');
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

    console.log(`[IRIS-Main] Found SOFIA user: "${sofiaUser.username}" <${sofiaUser.email}> â€” inserting into IRIS...`);

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
        // Duplicate â€” another process already inserted, that's fine
        console.log(`[IRIS-Main] User ${sofiaUser.email} inserted by another process â€” OK`);
        return;
      }

      if (error.code === '42501' || error.message?.includes('policy')) {
        console.error(`[IRIS-Main] âš ï¸ RLS bloquea INSERT en account_users.`);
        console.error(`[IRIS-Main]   Ejecuta en IRIS Supabase SQL Editor:`);
        console.error(`[IRIS-Main]   ALTER TABLE account_users DISABLE ROW LEVEL SECURITY;`);
        console.error(`[IRIS-Main]   O: CREATE POLICY "allow_insert_account_users" ON account_users FOR INSERT WITH CHECK (true);`);
      }

      console.error(`[IRIS-Main] ensureUserExistsInIris INSERT failed (${error.code}): ${error.message}`);
    } else {
      console.log(`[IRIS-Main] âœ… User "${sofiaUser.username}" (${userId}) synced to IRIS account_users`);
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
    // No need to fire-and-forget here â€” the sync happens at the point of use
    return { success: true, session: existing, message: `Ya autenticado como ${existing.fullName}` };
  }

  const sofia = getSofiaClient();
  if (!sofia) {
    return { success: false, message: 'Sistema de autenticaciÃ³n no disponible.' };
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
      return { success: false, message: 'No se encontrÃ³ un usuario con este nÃºmero de telÃ©fono.' };
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
      return { success: false, message: 'Tu nÃºmero de WhatsApp no estÃ¡ registrado en el sistema.' };
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
      message: `Â¡Detectado automÃ¡ticamente! Bienvenido/a, ${fullName}.`,
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
    return { success: false, message: 'El sistema de autenticaciÃ³n no estÃ¡ disponible.' };
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
      return { success: false, message: 'Error de conexiÃ³n con el sistema.' };
    }

    if (!authResult?.success) {
      return { success: false, message: authResult?.error || 'Credenciales invÃ¡lidas.' };
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
      message: `Â¡Autenticado exitosamente! Bienvenido/a, ${fullName}.`,
      fullName,
    };
  } catch (err: any) {
    console.error('[IRIS-Main] Auth error:', err);
    return { success: false, message: `Error de autenticaciÃ³n: ${err.message}` };
  }
}

/**
 * Check if a WhatsApp phone number has an active session
 */
export function getWhatsAppSession(phoneNumber: string): WhatsAppSession | null {
  return sessions.get(phoneNumber) || null;
}

export async function getSofiaUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  username?: string | null;
  display_name?: string | null;
} | null> {
  const sofia = getSofiaClient();
  if (!sofia || !email?.trim()) return null;

  try {
    const { data, error } = await sofia
      .from('users')
      .select('id, email, username, display_name')
      .ilike('email', email.trim())
      .maybeSingle();

    if (error) {
      console.error('[SOFIA-Main] getSofiaUserByEmail error:', error);
      return null;
    }

    return data
      ? {
        id: data.id,
        email: data.email,
        username: data.username ?? null,
        display_name: data.display_name ?? null,
      }
      : null;
  } catch (err) {
    console.error('[SOFIA-Main] getSofiaUserByEmail exception:', err);
    return null;
  }
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

// â”€â”€â”€ IRIS Data Access Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

export async function getProjects(teamRef?: string): Promise<IrisProject[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    let resolvedTeamId: string | null = null;
    if (teamRef?.trim()) {
      const teamResult = await resolveTeamReference(
        { teamId: teamRef, teamName: teamRef },
        { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para filtrar proyectos.' },
      );
      if (!teamResult.success) {
        console.warn('[IRIS-Main] getProjects team resolution failed:', teamResult.error);
        return [];
      }
      resolvedTeamId = teamResult.value.team_id;
    }

    let query = iris
      .from('pm_projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (resolvedTeamId) query = query.eq('team_id', resolvedTeamId);
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

function normalizeTeamMemberRecord(member: any): IrisTeamMember {
  return {
    ...member,
    member_id: member.member_id ?? member.membership_id,
    membership_id: member.membership_id ?? member.member_id,
  };
}

export async function getTeamMembers(teamRef: string): Promise<IrisTeamMember[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    const teamResult = await resolveTeamReference(
      { teamId: teamRef, teamName: teamRef },
      { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para listar miembros.' },
    );
    if (!teamResult.success) {
      console.warn('[IRIS-Main] getTeamMembers team resolution failed:', teamResult.error);
      return [];
    }

    const { data, error } = await iris
      .from('team_members')
      .select('*')
      .eq('team_id', teamResult.value.team_id)
      .eq('is_active', true);
    if (error) { console.error('[IRIS-Main] getTeamMembers error:', error); return []; }
    return (data || []).map(normalizeTeamMemberRecord);
  } catch (err) {
    console.error('[IRIS-Main] getTeamMembers exception:', err);
    return [];
  }
}

export async function getTeamMembersDetailed(teamRef: string): Promise<IrisTeamMemberDetail[]> {
  const iris = getIrisClient();
  if (!iris) return [];

  try {
    const members = await getTeamMembers(teamRef);
    if (members.length === 0) {
      return [];
    }

    const userIds = Array.from(new Set(members.map((member) => member.user_id).filter(Boolean)));
    if (userIds.length === 0) {
      return members;
    }

    const { data, error } = await iris
      .from('account_users')
      .select('user_id, display_name, email, username')
      .in('user_id', userIds);

    if (error) {
      console.error('[IRIS-Main] getTeamMembersDetailed error:', error);
      return members;
    }

    const byUserId = new Map(
      (data || []).map((user: any) => [user.user_id, user]),
    );

    return members.map((member) => {
      const user = byUserId.get(member.user_id);
      return {
        ...member,
        display_name: user?.display_name ?? null,
        email: user?.email ?? null,
        username: user?.username ?? null,
      };
    });
  } catch (err) {
    console.error('[IRIS-Main] getTeamMembersDetailed exception:', err);
    return [];
  }
}

// â”€â”€â”€ Statuses & Priorities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type IrisStatusRecord = {
  status_id: string;
  name: string;
  status_type: string;
  color?: string;
  position: number;
  is_default: boolean;
  is_closed?: boolean;
};

type IrisPriorityRecord = {
  priority_id: string;
  name: string;
  level: number;
  color: string;
};

export async function getStatuses(teamRef: string): Promise<IrisStatusRecord[]> {
  const iris = getIrisClient();
  if (!iris) return [];
  try {
    const teamResult = await resolveTeamReference(
      { teamId: teamRef, teamName: teamRef },
      { allowSingleTeamDefault: false, missingMessage: 'No encontre el equipo solicitado para listar estados.' },
    );
    if (!teamResult.success) {
      console.warn('[IRIS-Main] getStatuses team resolution failed:', teamResult.error);
      return [];
    }

    const { data, error } = await iris
      .from('task_statuses')
      .select('*')
      .eq('team_id', teamResult.value.team_id)
      .order('position');
    if (error) { console.error('[IRIS-Main] getStatuses error:', error); return []; }
    return data || [];
  } catch (err) {
    console.error('[IRIS-Main] getStatuses exception:', err);
    return [];
  }
}

export async function getPriorities(): Promise<IrisPriorityRecord[]> {
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

type ResolveResult<T> =
  | { success: true; value: T; warnings: string[] }
  | { success: false; error: string };

function isUuidLike(value: string | null | undefined): boolean {
  return !!value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.trim());
}

function buildPriorityAliases(priority: IrisPriorityRecord): string[] {
  const normalized = priority.name.toLowerCase();
  const aliases = [priority.name];

  if (normalized.includes('urgente')) aliases.push('urgent', 'critical');
  if (normalized.includes('alta')) aliases.push('high');
  if (normalized.includes('media')) aliases.push('medium');
  if (normalized.includes('baja')) aliases.push('low');
  if (normalized.includes('sin prioridad')) aliases.push('none', 'no priority');

  return aliases;
}

function buildStatusAliases(status: IrisStatusRecord): string[] {
  const aliases = [status.name, status.status_type];

  switch (status.status_type) {
    case 'backlog':
      aliases.push('por definir');
      break;
    case 'todo':
      aliases.push('to do', 'pendiente', 'por hacer');
      break;
    case 'in_progress':
      aliases.push('en progreso', 'doing');
      break;
    case 'in_review':
      aliases.push('revision', 'review', 'en revision');
      break;
    case 'done':
      aliases.push('hecho', 'completado', 'completed');
      break;
    case 'cancelled':
      aliases.push('cancelado');
      break;
    default:
      break;
  }

  return aliases;
}

async function resolveTeamReference(
  refs: { teamId?: string; teamName?: string },
  options?: { allowSingleTeamDefault?: boolean; missingMessage?: string },
): Promise<ResolveResult<IrisTeam>> {
  const teams = await getTeams();
  if (teams.length === 0) {
    return { success: false, error: 'IRIS no tiene equipos disponibles.' };
  }

  const explicitId = refs.teamId?.trim();
  if (explicitId) {
    const byId = teams.find((team) => team.team_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.teamName?.trim()) {
      return { success: false, error: `No existe el equipo con ID ${explicitId}.` };
    }
  }

  const query = refs.teamName?.trim() || refs.teamId?.trim() || '';
  if (query) {
    const resolution = resolveSearchCandidate(
      query,
      teams.map((team) => ({
        item: team,
        label: team.name,
        aliases: [team.slug],
      })),
    );

    if (resolution.match) {
      return { success: true, value: resolution.match, warnings: [] };
    }

    if (resolution.reason === 'ambiguous') {
      return {
        success: false,
        error: `El equipo "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
      };
    }

    return {
      success: false,
      error: options?.missingMessage || `No encontre el equipo "${query}" en IRIS.`,
    };
  }

  if (options?.allowSingleTeamDefault && teams.length === 1) {
    return {
      success: true,
      value: teams[0],
      warnings: [`Se uso el unico equipo activo disponible: ${teams[0].name}.`],
    };
  }

  return {
    success: false,
    error: options?.missingMessage || 'Debes indicar el equipo objetivo antes de escribir en IRIS.',
  };
}

export async function resolveProjectReference(refs: {
  projectId?: string;
  projectName?: string;
  scopedTeamId?: string;
}): Promise<ResolveResult<IrisProject | null>> {
  const query = refs.projectName?.trim() || refs.projectId?.trim() || '';
  if (!query) {
    return { success: true, value: null, warnings: [] };
  }

  const projects = await getProjects(refs.scopedTeamId);
  if (projects.length === 0) {
    return { success: false, error: 'No hay proyectos disponibles en el alcance seleccionado.' };
  }

  const explicitId = refs.projectId?.trim();
  if (explicitId) {
    const byId = projects.find((project) => project.project_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.projectName?.trim()) {
      return { success: false, error: `No existe el proyecto con ID ${explicitId}.` };
    }
  }

  const resolution = resolveSearchCandidate(
    query,
    projects.map((project) => ({
      item: project,
      label: project.project_name,
      aliases: [project.project_key, project.project_description],
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `El proyecto "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre el proyecto "${query}" en IRIS.` };
}

export async function resolveStatusReference(refs: {
  statusId?: string;
  statusName?: string;
  teamId: string;
}): Promise<ResolveResult<IrisStatusRecord>> {
  const statuses = await getStatuses(refs.teamId);
  if (statuses.length === 0) {
    return { success: false, error: 'El equipo no tiene estados configurados en IRIS.' };
  }

  const explicitId = refs.statusId?.trim();
  if (explicitId) {
    const byId = statuses.find((status) => status.status_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.statusName?.trim()) {
      return { success: false, error: `No existe el estado con ID ${explicitId}.` };
    }
  }

  const query = refs.statusName?.trim() || refs.statusId?.trim() || '';
  if (!query) {
    const fallback =
      statuses.find((status) => status.is_default) ||
      statuses.find((status) => status.status_type === 'backlog') ||
      statuses.find((status) => status.status_type === 'todo') ||
      statuses[0];
    return { success: true, value: fallback, warnings: [] };
  }

  const resolution = resolveSearchCandidate(
    query,
    statuses.map((status) => ({
      item: status,
      label: status.name,
      aliases: buildStatusAliases(status),
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `El estado "${query}" es ambiguo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre el estado "${query}" para el equipo seleccionado.` };
}

export async function resolvePriorityReference(refs: {
  priorityId?: string;
  priorityName?: string;
}): Promise<ResolveResult<IrisPriorityRecord | null>> {
  const query = refs.priorityName?.trim() || refs.priorityId?.trim() || '';
  if (!query) {
    return { success: true, value: null, warnings: [] };
  }

  const priorities = await getPriorities();
  if (priorities.length === 0) {
    return { success: false, error: 'IRIS no tiene prioridades configuradas.' };
  }

  const explicitId = refs.priorityId?.trim();
  if (explicitId) {
    const byId = priorities.find((priority) => priority.priority_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.priorityName?.trim()) {
      return { success: false, error: `No existe la prioridad con ID ${explicitId}.` };
    }
  }

  const resolution = resolveSearchCandidate(
    query,
    priorities.map((priority) => ({
      item: priority,
      label: priority.name,
      aliases: buildPriorityAliases(priority),
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `La prioridad "${query}" es ambigua. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre la prioridad "${query}" en IRIS.` };
}

export async function resolveAssigneeReference(refs: {
  assigneeId?: string;
  assigneeQuery?: string;
  teamId: string;
}): Promise<ResolveResult<IrisTeamMemberDetail | null>> {
  const query = refs.assigneeQuery?.trim() || refs.assigneeId?.trim() || '';
  if (!query) {
    return { success: true, value: null, warnings: [] };
  }

  const members = await getTeamMembersDetailed(refs.teamId);
  if (members.length === 0) {
    return { success: false, error: 'El equipo seleccionado no tiene miembros disponibles para asignacion.' };
  }

  const explicitId = refs.assigneeId?.trim();
  if (explicitId) {
    const byId = members.find((member) => member.user_id === explicitId);
    if (byId) {
      return { success: true, value: byId, warnings: [] };
    }
    if (isUuidLike(explicitId) && !refs.assigneeQuery?.trim()) {
      return { success: false, error: 'El usuario asignado no pertenece al equipo seleccionado.' };
    }
  }

  const resolution = resolveSearchCandidate(
    query,
    members.map((member) => ({
      item: member,
      label: member.display_name || member.username || member.email || member.user_id,
      aliases: [member.username, member.email, member.email?.split('@')[0], member.user_id],
    })),
  );

  if (resolution.match) {
    return { success: true, value: resolution.match, warnings: [] };
  }

  if (resolution.reason === 'ambiguous') {
    return {
      success: false,
      error: `El responsable "${query}" es ambiguo dentro del equipo. Opciones: ${describeResolutionCandidates(resolution.candidates)}.`,
    };
  }

  return { success: false, error: `No encontre a "${query}" dentro del equipo seleccionado.` };
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get the next issue_number for a team (auto-increment).
 * issue_number is NOT auto-generated by the database â€” it must be set by application code.
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

// â”€â”€â”€ WRITE Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create a new issue/task in IRIS
 */
export async function createIssue(params: {
  teamId?: string;
  teamName?: string;
  title: string;
  creatorId: string;
  statusId?: string;
  statusName?: string;
  priorityId?: string;
  priorityName?: string;
  projectId?: string;
  projectName?: string;
  assigneeId?: string;
  assigneeQuery?: string;
  description?: string;
  dueDate?: string;
}): Promise<{ success: boolean; issue?: any; error?: string; warnings?: string[] }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no esta disponible.' };

  try {
    const title = params.title?.trim();
    if (!title) {
      return { success: false, error: 'La tarea necesita un titulo valido.' };
    }

    const warnings: string[] = [];
    let explicitTeam: IrisTeam | null = null;
    if (params.teamId?.trim() || params.teamName?.trim()) {
      const teamResolution = await resolveTeamReference(
        { teamId: params.teamId, teamName: params.teamName },
        {
          allowSingleTeamDefault: false,
          missingMessage: 'No encontre el equipo indicado para crear la tarea.',
        },
      );
      if (!teamResolution.success) {
        return { success: false, error: teamResolution.error };
      }
      explicitTeam = teamResolution.value;
      warnings.push(...teamResolution.warnings);
    }

    const projectResult = await resolveProjectReference({
      projectId: params.projectId,
      projectName: params.projectName,
      scopedTeamId: explicitTeam?.team_id,
    });
    if (!projectResult.success) {
      return { success: false, error: projectResult.error, warnings };
    }
    warnings.push(...projectResult.warnings);

    const resolvedProject = projectResult.value;
    const teams = await getTeams();
    let effectiveTeam = explicitTeam;

    if (resolvedProject?.team_id) {
      const projectTeam = teams.find((team) => team.team_id === resolvedProject.team_id) || null;
      if (!projectTeam) {
        return { success: false, error: 'El proyecto seleccionado no tiene un equipo valido en IRIS.', warnings };
      }
      if (explicitTeam && explicitTeam.team_id !== projectTeam.team_id) {
        return {
          success: false,
          error: `El proyecto "${resolvedProject.project_name}" pertenece al equipo "${projectTeam.name}" y no al equipo "${explicitTeam.name}".`,
          warnings,
        };
      }
      effectiveTeam = projectTeam;
    }

    if (!effectiveTeam) {
      const teamResult = await resolveTeamReference(
        { teamId: params.teamId, teamName: params.teamName },
        {
          allowSingleTeamDefault: true,
          missingMessage: 'Debes indicar el equipo donde se va a crear la tarea.',
        },
      );
      if (!teamResult.success) {
        return { success: false, error: teamResult.error, warnings };
      }
      warnings.push(...teamResult.warnings);
      effectiveTeam = teamResult.value;
    }

    const statusResult = await resolveStatusReference({
      statusId: params.statusId,
      statusName: params.statusName,
      teamId: effectiveTeam.team_id,
    });
    if (!statusResult.success) {
      return { success: false, error: statusResult.error, warnings };
    }
    warnings.push(...statusResult.warnings);

    const priorityResult = await resolvePriorityReference({
      priorityId: params.priorityId,
      priorityName: params.priorityName,
    });
    if (!priorityResult.success) {
      return { success: false, error: priorityResult.error, warnings };
    }
    warnings.push(...priorityResult.warnings);

    const assigneeResult = await resolveAssigneeReference({
      assigneeId: params.assigneeId,
      assigneeQuery: params.assigneeQuery,
      teamId: effectiveTeam.team_id,
    });
    if (!assigneeResult.success) {
      return { success: false, error: assigneeResult.error, warnings };
    }
    warnings.push(...assigneeResult.warnings);

    await ensureUserExistsInIris(params.creatorId);
    if (assigneeResult.value?.user_id && assigneeResult.value.user_id !== params.creatorId) {
      await ensureUserExistsInIris(assigneeResult.value.user_id);
    }

    const insertBase: Record<string, any> = {
      team_id: effectiveTeam.team_id,
      title,
      creator_id: params.creatorId,
      status_id: statusResult.value.status_id,
    };
    if (priorityResult.value?.priority_id) insertBase.priority_id = priorityResult.value.priority_id;
    if (resolvedProject?.project_id) insertBase.project_id = resolvedProject.project_id;
    if (assigneeResult.value?.user_id) insertBase.assignee_id = assigneeResult.value.user_id;
    if (params.description?.trim()) insertBase.description = params.description.trim();
    if (params.dueDate?.trim()) insertBase.due_date = params.dueDate.trim();

    let lastError: any = null;
    let collisionWarningAdded = false;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const issueNumber = await getNextIssueNumber(effectiveTeam.team_id);
      const { data, error } = await iris
        .from('task_issues')
        .insert({
          ...insertBase,
          issue_number: issueNumber,
        })
        .select('*, status:task_statuses(*), priority:task_priorities(*)')
        .single();

      if (!error) {
        console.log(`[IRIS-Main] Issue created: #${data.issue_number} "${data.title}"`);
        return {
          success: true,
          issue: data,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }

      lastError = error;
      const duplicateIssueNumber =
        error.code === '23505' &&
        `${error.message || ''} ${error.details || ''}`.toLowerCase().includes('issue_number');

      if (duplicateIssueNumber && attempt < 3) {
        if (!collisionWarningAdded) {
          warnings.push('Hubo una colision temporal al asignar el numero de issue y se reintento la creacion.');
          collisionWarningAdded = true;
        }
        continue;
      }

      console.error('[IRIS-Main] createIssue error:', error);
      return {
        success: false,
        error: error.message,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    return {
      success: false,
      error: lastError?.message || 'No se pudo crear la tarea en IRIS.',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
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
  if (!iris) return { success: false, error: 'IRIS no estÃ¡ disponible.' };

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

    if (!issueId) return { success: false, error: 'No se encontrÃ³ la tarea especificada.' };

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

    if (!statusId) return { success: false, error: 'No se encontrÃ³ el estado especificado.' };

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
  projectKey?: string;
  createdByUserId: string;
  teamId?: string;
  teamName?: string;
  description?: string;
  priorityLevel?: string;
  startDate?: string;
  targetDate?: string;
}): Promise<{ success: boolean; project?: any; error?: string; warnings?: string[] }> {
  const iris = getIrisClient();
  if (!iris) return { success: false, error: 'IRIS no estÃ¡ disponible.' };

  try {
    const projectName = params.projectName?.trim();
    if (!projectName) {
      return { success: false, error: 'El proyecto necesita un nombre valido.' };
    }

    const warnings: string[] = [];
    const teamResult = await resolveTeamReference(
      { teamId: params.teamId, teamName: params.teamName },
      {
        allowSingleTeamDefault: true,
        missingMessage: 'Debes indicar el equipo donde se va a crear el proyecto.',
      },
    );
    if (!teamResult.success) {
      return { success: false, error: teamResult.error };
    }
    warnings.push(...teamResult.warnings);

    // Ensure the creator user exists in IRIS before INSERT (FK constraint fix)
    await ensureUserExistsInIris(params.createdByUserId);

    const existingProjects = await getProjects(teamResult.value.team_id);
    const normalizedRequestedKey = normalizeProjectKey(params.projectKey);
    const projectKey = generateUniqueProjectKey(
      projectName,
      existingProjects.map((project) => project.project_key),
      params.projectKey,
    );

    if (!normalizedRequestedKey) {
      warnings.push(`Se genero automaticamente la clave del proyecto: ${projectKey}.`);
    } else if (projectKey !== normalizedRequestedKey) {
      warnings.push(`La clave ${normalizedRequestedKey} ya estaba en uso y se genero ${projectKey}.`);
    }

    const insertData: Record<string, any> = {
      project_name: projectName,
      project_key: projectKey,
      created_by_user_id: params.createdByUserId,
      project_status: 'planning',
      health_status: 'none',
      priority_level: params.priorityLevel || 'medium',
      completion_percentage: 0,
      is_public: true,
      is_template: false,
      team_id: teamResult.value.team_id,
    };
    if (params.description?.trim()) insertData.project_description = params.description.trim();
    if (params.startDate?.trim()) insertData.start_date = params.startDate.trim();
    if (params.targetDate?.trim()) insertData.target_date = params.targetDate.trim();

    const { data, error } = await iris
      .from('pm_projects')
      .insert(insertData)
      .select('*')
      .single();

    if (error) {
      console.error('[IRIS-Main] createProject error:', error);
      return {
        success: false,
        error: error.message,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    console.log(`[IRIS-Main] Project created: "${data.project_name}" [${data.project_key}]`);
    return {
      success: true,
      project: data,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
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
  if (!iris) return { success: false, error: 'IRIS no estÃ¡ disponible.' };

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
    const teamById = new Map(teams.map((team) => [team.team_id, team]));
    if (teams.length > 0) {
      parts.push('\n## Equipos:');
      for (const team of teams.slice(0, 5)) {
        parts.push(`- ${team.name} (${team.slug}) | Estado: ${team.status} | ID: ${team.team_id}`);
        const members = await getTeamMembersDetailed(team.team_id);
        if (members.length > 0) {
          const preview = members
            .slice(0, 5)
            .map((member) => member.display_name || member.username || member.email || member.user_id)
            .join(', ');
          parts.push(`  Miembros: ${preview}`);
        }
      }
    }

    const projects = await getProjects();
    const projectById = new Map(projects.map((project) => [project.project_id, project]));
    if (projects.length > 0) {
      parts.push('\n## Proyectos:');
      for (const proj of projects.slice(0, 10)) {
        const teamName = proj.team_id ? teamById.get(proj.team_id)?.name || proj.team_id : 'Sin equipo';
        const description = proj.project_description ? ` | Descripcion: ${proj.project_description}` : '';
        parts.push(`- ${proj.project_name} [${proj.project_key}] | Equipo: ${teamName} | Estado: ${proj.project_status} | Progreso: ${proj.completion_percentage}% | Prioridad: ${proj.priority_level} | ID: ${proj.project_id}${description}`);
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
          const projectName = issue.project_id ? projectById.get(issue.project_id)?.project_name || issue.project_id : 'Sin proyecto';
          const dueStr = issue.due_date ? ` | Vence: ${issue.due_date}` : '';
          parts.push(`- #${issue.issue_number} ${issue.title} | Proyecto: ${projectName} | Estado: ${statusName} | Prioridad: ${priorityName}${dueStr}`);
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
            const projectName = issue.project_id ? projectById.get(issue.project_id)?.project_name || issue.project_id : 'Sin proyecto';
            const assigneeStr = issue.assignee_id ? ` | Asignado: ${issue.assignee_id}` : ' | Sin asignar';
            parts.push(`- #${issue.issue_number} ${issue.title} | Proyecto: ${projectName} | Estado: ${statusName} | Prioridad: ${priorityName}${assigneeStr}`);
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

// â”€â”€â”€ Keywords for IRIS query detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  'login', 'inicio de sesion', 'iniciar sesion', 'iniciar sesiÃ³n',
  'cerrar sesion', 'cerrar sesiÃ³n', 'logout',
  'autenticar', 'authenticate',
];

export function needsIrisData(message: string): boolean {
  const lower = message.toLowerCase();
  return IRIS_KEYWORDS.some(kw => lower.includes(kw));
}

