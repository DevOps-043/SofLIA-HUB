import { supabase } from '../../lib/supabase';
import { invalidateApiKeyCache } from './cache';
import { observeApiKeySession } from './session-scope';
import type { ApiKeyInput, ApiKeyProvider } from './types';

type MutationResult = { success: boolean; error?: string };

export async function saveUserApiKey(input: ApiKeyInput): Promise<MutationResult> {
  invalidateApiKeyCache();
  const scope = observeApiKeySession();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!scope.isCurrent()) return { success: false, error: 'La sesión cambió. Intenta de nuevo.' };
    if (!user) return { success: false, error: 'Inicia sesión para administrar las claves.' };

    const { error } = await supabase
      .from('api_keys')
      .upsert({
        user_id: user.id,
        provider: input.provider,
        api_key: input.api_key,
        is_system_default: false,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      });

    if (!scope.isCurrent()) return { success: false, error: 'La sesión cambió; no se confirmó el resultado. Revisa la configuración.' };
    if (error) {
      console.error('[Claves] No se pudo guardar la credencial.');
      return { success: false, error: 'No se pudo guardar la credencial. Intenta de nuevo.' };
    }
    return { success: true };
  } catch {
    console.error('[Claves] No se pudo guardar la credencial.');
    return { success: false, error: 'No se pudo guardar la credencial. Intenta de nuevo.' };
  } finally {
    scope.dispose();
    invalidateApiKeyCache();
  }
}

export async function deleteUserApiKey(provider: ApiKeyProvider = 'google'): Promise<MutationResult> {
  invalidateApiKeyCache();
  const scope = observeApiKeySession();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!scope.isCurrent()) return { success: false, error: 'La sesión cambió. Intenta de nuevo.' };
    if (!user) return { success: false, error: 'Inicia sesión para administrar las claves.' };

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (!scope.isCurrent()) return { success: false, error: 'La sesión cambió; no se confirmó el resultado. Revisa la configuración.' };
    if (error) {
      console.error('[Claves] No se pudo eliminar la credencial.');
      return { success: false, error: 'No se pudo eliminar la credencial. Intenta de nuevo.' };
    }
    return { success: true };
  } catch {
    console.error('[Claves] No se pudo eliminar la credencial.');
    return { success: false, error: 'No se pudo eliminar la credencial. Intenta de nuevo.' };
  } finally {
    scope.dispose();
    invalidateApiKeyCache();
  }
}
