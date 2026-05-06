/**
 * Sincronización de usuarios SOFIA → IRIS.
 *
 * Garantiza que un userId exista en `iris.account_users` antes de cualquier
 * INSERT que tenga FK a esa tabla (pm_projects.created_by_user_id,
 * task_issues.creator_id, etc.). Sin esto, el INSERT explota con FK violation.
 *
 * SOFIA es la fuente de verdad — IRIS solo cachea el subset necesario.
 */

import { getIrisClient, getSofiaClient } from './clients';

/**
 * Asegura que el userId existe en `iris.account_users`. Si no existe, lo trae
 * desde SOFIA y lo upserta. Idempotente y tolerante a race conditions
 * (otro proceso puede haberlo insertado en paralelo).
 *
 * **Debe llamarse (con `await`) ANTES de cualquier INSERT con FK a account_users.**
 */
export async function ensureUserExistsInIris(userId: string): Promise<void> {
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

    if (existing) return;

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
      console.error(
        `[IRIS-Main] Could not fetch user ${userId} from SOFIA:`,
        sofiaError?.message || 'user not found',
      );
      return;
    }

    console.log(`[IRIS-Main] Found SOFIA user: "${sofiaUser.username}" <${sofiaUser.email}> — inserting into IRIS...`);

    // 3. Build IRIS account_users record (matches IRIS schema requirements).
    const lastNameParts = (sofiaUser.last_name || '').trim().split(/\s+/);
    const lastNamePaternal = lastNameParts[0] || sofiaUser.username;
    const lastNameMaternal = lastNameParts.length > 1 ? lastNameParts.slice(1).join(' ') : null;

    const userData = {
      user_id: sofiaUser.id,
      first_name: sofiaUser.first_name || sofiaUser.username,
      last_name_paternal: lastNamePaternal,
      last_name_maternal: lastNameMaternal,
      display_name:
        sofiaUser.display_name ||
        `${sofiaUser.first_name || ''} ${sofiaUser.last_name || ''}`.trim() ||
        sofiaUser.username,
      username: sofiaUser.username,
      email: sofiaUser.email,
      password_hash: 'SOFIA_MANAGED_AUTH',
      permission_level: 'user',
      account_status: 'active',
      is_email_verified: true,
      phone_number: sofiaUser.phone || null,
      avatar_url: sofiaUser.profile_picture_url || null,
    };

    // 4. Upsert into IRIS (handles race conditions gracefully).
    const { error } = await iris
      .from('account_users')
      .upsert(userData, { onConflict: 'user_id', ignoreDuplicates: true });

    if (error) {
      // Race condition: otro proceso lo insertó entre nuestro check y nuestro insert. OK.
      if (error.code === '23505') {
        console.log(`[IRIS-Main] User ${sofiaUser.email} inserted by another process — OK`);
        return;
      }

      if (error.code === '42501' || error.message?.includes('policy')) {
        console.error('[IRIS-Main] ⚠️ RLS bloquea INSERT en account_users.');
        console.error('[IRIS-Main]   Ejecuta en IRIS Supabase SQL Editor:');
        console.error('[IRIS-Main]   ALTER TABLE account_users DISABLE ROW LEVEL SECURITY;');
        console.error('[IRIS-Main]   O: CREATE POLICY "allow_insert_account_users" ON account_users FOR INSERT WITH CHECK (true);');
      }

      console.error(`[IRIS-Main] ensureUserExistsInIris INSERT failed (${error.code}): ${error.message}`);
    } else {
      console.log(`[IRIS-Main] ✅ User "${sofiaUser.username}" (${userId}) synced to IRIS account_users`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] ensureUserExistsInIris exception:', message);
  }
}

/**
 * Búsqueda de usuario SOFIA por email (case-insensitive).
 * Devuelve solo los campos públicos necesarios para identificación.
 */
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
