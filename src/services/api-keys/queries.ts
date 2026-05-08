import { supabase } from '../../lib/supabase';
import type { ApiKeyProvider, ApiKeyRecord } from './types';

export async function getApiKey(provider: ApiKeyProvider = 'google'): Promise<string | null> {
  try {
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

export async function getUserApiKey(provider: ApiKeyProvider = 'google'): Promise<ApiKeyRecord | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user API key:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Error in getUserApiKey:', error);
    return null;
  }
}

export async function hasUserApiKey(provider: ApiKeyProvider = 'google'): Promise<boolean> {
  return (await getUserApiKey(provider)) !== null;
}
