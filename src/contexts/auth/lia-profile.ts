import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { normalizeEmail } from './helpers';

export async function syncLiaProfile(liaSession: Session | null): Promise<void> {
  const liaUser = liaSession?.user;
  if (!liaUser?.id || typeof (supabase as any).from !== 'function') return;

  const metadata = (liaUser.user_metadata || {}) as Record<string, any>;
  const email = normalizeEmail(liaUser.email) || liaUser.email || null;
  const fullName =
    metadata.full_name ||
    metadata.name ||
    [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim() ||
    null;
  const avatarUrl = metadata.avatar_url || metadata.picture || null;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: liaUser.id, email, full_name: fullName, avatar_url: avatarUrl }, { onConflict: 'id' });

  if (error) {
    console.warn('No se pudo sincronizar el perfil base de Lia:', error.message);
  }
}
