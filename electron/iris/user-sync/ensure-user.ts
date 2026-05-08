import { getIrisClient, getSofiaClient } from '../clients';
import { mapSofiaUserToIrisAccountUser } from './user-mapper';

export async function ensureUserExistsInIris(userId: string): Promise<void> {
  const iris = getIrisClient();
  if (!iris) {
    console.warn('[IRIS-Main] ensureUserExistsInIris: no IRIS client available');
    return;
  }

  try {
    const { data: existing } = await iris
      .from('account_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return;
    console.log(`[IRIS-Main] User ${userId} NOT found in IRIS account_users - fetching from SOFIA...`);

    const sofia = getSofiaClient();
    if (!sofia) {
      console.error('[IRIS-Main] ensureUserExistsInIris: no SOFIA client - cannot fetch user data');
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

    const { error } = await iris
      .from('account_users')
      .upsert(mapSofiaUserToIrisAccountUser(sofiaUser), { onConflict: 'user_id', ignoreDuplicates: true });

    handleIrisUserInsertResult(error, sofiaUser, userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[IRIS-Main] ensureUserExistsInIris exception:', message);
  }
}

function handleIrisUserInsertResult(error: any, sofiaUser: any, userId: string): void {
  if (!error) {
    console.log(`[IRIS-Main] User "${sofiaUser.username}" (${userId}) synced to IRIS account_users`);
    return;
  }

  if (error.code === '23505') {
    console.log(`[IRIS-Main] User ${sofiaUser.email} inserted by another process - OK`);
    return;
  }

  if (error.code === '42501' || error.message?.includes('policy')) {
    console.error('[IRIS-Main] RLS bloquea INSERT en account_users.');
    console.error('[IRIS-Main] Ejecuta en IRIS Supabase SQL Editor: ALTER TABLE account_users DISABLE ROW LEVEL SECURITY;');
  }

  console.error(`[IRIS-Main] ensureUserExistsInIris INSERT failed (${error.code}): ${error.message}`);
}
