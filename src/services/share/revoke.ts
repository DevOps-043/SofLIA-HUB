import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { ShareTargetType } from './types';

export async function revokeShare(shareId: string, targetType: ShareTargetType): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const table = targetType === 'conversation' ? 'conversation_shares' : 'folder_shares';
  const { error } = await supabase
    .from(table)
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', shareId);

  if (error) {
    console.error('[share-service] revokeShare FAILED:', error.message, '| code:', error.code);
    return false;
  }

  return true;
}
