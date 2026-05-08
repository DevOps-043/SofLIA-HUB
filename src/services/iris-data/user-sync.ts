import { irisSupa, isIrisConfigured } from '../../lib/iris-client';
import { isSofiaConfigured, sofiaSupa } from '../../lib/sofia-client';

export async function ensureUserExistsInIris(userId: string): Promise<void> {
  if (!irisSupa || !isIrisConfigured() || !sofiaSupa || !isSofiaConfigured()) return;
  try {
    const { data: existing } = await irisSupa.from('account_users').select('user_id').eq('user_id', userId).maybeSingle();
    if (existing) return;

    const { data: sofiaUser, error } = await sofiaSupa
      .from('users')
      .select('id, username, email, first_name, last_name, display_name, phone, profile_picture_url')
      .eq('id', userId)
      .maybeSingle();
    if (error || !sofiaUser) return;

    const lastNameParts = (sofiaUser.last_name || '').trim().split(/\s+/).filter(Boolean);
    const payload = {
      user_id: sofiaUser.id,
      first_name: sofiaUser.first_name || sofiaUser.username,
      last_name_paternal: lastNameParts[0] || sofiaUser.username,
      last_name_maternal: lastNameParts.length > 1 ? lastNameParts.slice(1).join(' ') : null,
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

    const { error: upsertError } = await irisSupa.from('account_users').upsert(payload, { onConflict: 'user_id', ignoreDuplicates: true });
    if (upsertError && upsertError.code !== '23505') console.error('IRIS: ensureUserExistsInIris upsert failed', upsertError);
  } catch (err) {
    console.error('IRIS: ensureUserExistsInIris exception', err);
  }
}
