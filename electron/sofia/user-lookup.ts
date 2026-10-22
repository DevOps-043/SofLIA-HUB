import { getSofiaClient } from './clients';

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
      console.error('[SOFIA-Main] Error al consultar usuario por correo:', error);
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
    console.error('[SOFIA-Main] Excepción al consultar usuario por correo:', err);
    return null;
  }
}
