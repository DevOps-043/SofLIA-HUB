
import { supabase } from '../lib/supabase';

// ============================================
// TYPES
// ============================================
export interface ApiKeyRecord {
  id: string;
  user_id: string | null;
  provider: 'google' | 'openai';
  api_key: string;
  is_system_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyInput {
  provider: 'google' | 'openai';
  api_key: string;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Obtiene la API key activa para un provider
 * Primero busca la key del usuario, si no existe usa la del sistema
 */
export async function getApiKey(provider: 'google' | 'openai' = 'google'): Promise<string | null> {
  try {
    // Usar la función RPC que maneja la lógica de fallback
    const { data, error } = await supabase.rpc('get_api_key', { p_provider: provider });

    if (error) {
      console.error('Error fetching API key:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getApiKey:', error);
    return null;
  }
}

/**
 * Obtiene la API key del usuario actual (sin fallback a system)
 */
export async function getUserApiKey(provider: 'google' | 'openai' = 'google'): Promise<ApiKeyRecord | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching user API key:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserApiKey:', error);
    return null;
  }
}

/**
 * Guarda o actualiza la API key del usuario
 */
export async function saveUserApiKey(input: ApiKeyInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No authenticated user' };
    }

    // Upsert: insertar o actualizar si ya existe
    const { error } = await supabase
      .from('api_keys')
      .upsert({
        user_id: user.id,
        provider: input.provider,
        api_key: input.api_key,
        is_system_default: false,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider'
      });

    if (error) {
      console.error('Error saving API key:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in saveUserApiKey:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Elimina la API key del usuario
 */
export async function deleteUserApiKey(provider: 'google' | 'openai' = 'google'): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No authenticated user' };
    }

    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (error) {
      console.error('Error deleting API key:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteUserApiKey:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica si una API key es válida
 */
export async function validateApiKey(apiKey: string, provider: 'google' | 'openai' = 'google'): Promise<boolean> {
  if (!apiKey || apiKey.length < 10) return false;

  try {
    if (provider === 'google') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    }
    // Add OpenAI validation if needed
    return false;
  } catch {
    return false;
  }
}

/**
 * Verifica si el usuario tiene una API key personalizada
 */
export async function hasUserApiKey(provider: 'google' | 'openai' = 'google'): Promise<boolean> {
  const userKey = await getUserApiKey(provider);
  return userKey !== null;
}

// ============================================
// CACHE PARA EVITAR LLAMADAS REPETIDAS
// ============================================
let cachedApiKey: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la API key con cache para evitar llamadas repetidas a la DB
 */
export async function getApiKeyWithCache(provider: 'google' | 'openai' = 'google'): Promise<string | null> {
  const now = Date.now();

  // Si el cache es válido, retornar
  if (cachedApiKey && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedApiKey;
  }

  // Obtener de la base de datos
  cachedApiKey = await getApiKey(provider);
  cacheTimestamp = now;

  return cachedApiKey;
}

/**
 * Invalida el cache (llamar después de guardar/eliminar una key)
 */
export function invalidateApiKeyCache(): void {
  cachedApiKey = null;
  cacheTimestamp = 0;
}
