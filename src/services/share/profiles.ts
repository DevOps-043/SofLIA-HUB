import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { normalizeEmail, normalizeProfile } from './normalizers';
import type { LiaProfile } from './types';

export async function resolveTargetProfileByEmail(email: string): Promise<LiaProfile> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('El miembro seleccionado no tiene un correo valido en SOFIA.');
  }

  const profilesByEmail = await resolveLiaProfilesByEmails([normalizedEmail]);
  const profile = profilesByEmail.get(normalizedEmail);
  if (!profile?.id) {
    throw new Error(
      'Ese miembro aun no tiene perfil activo en Lia. Necesita iniciar sesion al menos una vez para habilitar chats compartidos.',
    );
  }

  return profile;
}

export async function resolveLiaProfilesByEmails(emails: string[]): Promise<Map<string, LiaProfile>> {
  const normalizedEmails = Array.from(
    new Set(
      emails
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => Boolean(email)),
    ),
  );

  if (!isSupabaseConfigured() || normalizedEmails.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, username')
    .in('email', normalizedEmails);

  if (error) {
    console.error('[share-service] resolveLiaProfilesByEmails FAILED:', error.message, '| code:', error.code);
    return new Map();
  }

  return new Map(
    (data || [])
      .map((profile: any) => normalizeProfile(profile))
      .map((profile) => [normalizeEmail(profile.email)!, profile]),
  );
}
