import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { LearningLiveSessionReference } from '../src/shared/learning-live-session';

export type StudioRealtimeNotice = { session_id: string; status: 'connected' | 'disconnected' | 'changed' };
/** Solo invalidaciones; contenido y permisos se recuperan mediante la API académica. */
export function subscribeStudioRevisions(client: SupabaseClient, reference: LearningLiveSessionReference, notify: (notice: StudioRealtimeNotice) => void): () => void {
  let disposed = false;
  const emit = (status: StudioRealtimeNotice['status']) => { if (!disposed) notify({ session_id: reference.session_id, status }); };
  const channel: RealtimeChannel = client.channel(`studio:${reference.session_id}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_studio_revisions', filter: `session_id=eq.${reference.session_id}` }, () => emit('changed'))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_studio_revisions', filter: `session_id=eq.${reference.session_id}` }, () => emit('changed'))
    .subscribe((status) => emit(status === 'SUBSCRIBED' ? 'connected' : 'disconnected'));
  return () => { if (disposed) return; disposed = true; void client.removeChannel(channel); };
}
