import { supabase } from '../../lib/supabase';
import type { ApiKeyInput, ApiKeyRecord, ApiProvider } from './types';

export async function getApiKey(provider: ApiProvider = 'google'): Promise<string | null> {
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

export async function getUserApiKey(provider: ApiProvider = 'google'): Promise<ApiKeyRecord | null> {
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

export async function saveUserApiKey(input: ApiKeyInput): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No authenticated user' };

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

export async function deleteUserApiKey(provider: ApiProvider = 'google'): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No authenticated user' };

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
