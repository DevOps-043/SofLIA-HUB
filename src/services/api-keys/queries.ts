import { supabase } from '../../lib/supabase';
import type { ApiKeyProvider, ApiKeyRecord } from './types';
import { observeApiKeySession } from './session-scope';

export async function getApiKey(provider: ApiKeyProvider = 'google'): Promise<string | null> {
  const scope = observeApiKeySession(true);
  try {
    let result;
    try { result = await supabase.rpc('get_api_key', { p_provider: provider }); }
    catch { throw new Error('No se pudo consultar la credencial. Intenta de nuevo.'); }
    if (!scope.isCurrent()) throw new Error('La sesión o la configuración de claves cambió. Intenta de nuevo.');
    if (result.error || (result.data !== null && typeof result.data !== 'string')) {
      throw new Error('No se pudo consultar la credencial. Intenta de nuevo.');
    }
    return result.data;
  } finally { scope.dispose(); }
}

export async function getUserApiKey(provider: ApiKeyProvider = 'google'): Promise<ApiKeyRecord | null> {
  const scope = observeApiKeySession(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!scope.isCurrent() || !user) return null;

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (!scope.isCurrent()) return null;
    if (error && error.code !== 'PGRST116') {
      console.error('[Claves] No se pudo consultar la configuración personal.');
      return null;
    }
    return data;
  } catch {
    console.error('[Claves] No se pudo consultar la configuración personal.');
    return null;
  } finally {
    scope.dispose();
  }
}

export async function hasUserApiKey(provider: ApiKeyProvider = 'google'): Promise<boolean> {
  return (await getUserApiKey(provider)) !== null;
}
