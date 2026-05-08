import { supabase } from '../../lib/supabase';
import type { ApiKeyInput, ApiKeyProvider } from './types';

type MutationResult = { success: boolean; error?: string };

export async function saveUserApiKey(input: ApiKeyInput): Promise<MutationResult> {
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

export async function deleteUserApiKey(provider: ApiKeyProvider = 'google'): Promise<MutationResult> {
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
