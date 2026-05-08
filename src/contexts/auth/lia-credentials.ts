const LEGACY_LIA_CRED_KEY = 'lia-sync-cred';

/**
 * Limpia credenciales heredadas. Las contrasenas ya no se persisten en el
 * renderer; la sesion Lia debe restaurarse con los tokens propios de Supabase.
 */
export function clearLiaCredentials() {
  try {
    localStorage.removeItem(LEGACY_LIA_CRED_KEY);
  } catch {
    // Local persistence is optional.
  }
}
