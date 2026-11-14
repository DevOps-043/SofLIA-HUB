import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackgroundJob, BackgroundScope } from '../../src/shared/background-teams';

/** Sólo lectura: un registro local sin custodia requiere comprobar su conversación. */
export async function verifyLegacyWorkspaceOwner(client: SupabaseClient, job: BackgroundJob, authorize: (scope: BackgroundScope) => Promise<void>): Promise<void> {
  await authorize(job.scope);
  if (!job.scope.dataUserId) throw new Error('El propietario de la conversación no está disponible.');
  let query = client.from('conversations').select('id,user_id,org_id,deleted_at')
    .eq('id', job.conversationId).eq('user_id', job.scope.dataUserId).is('deleted_at', null);
  query = job.scope.organizationId ? query.eq('org_id', job.scope.organizationId) : query.is('org_id', null);
  const { data, error } = await query.limit(1).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
  await authorize(job.scope);
  if (error || !data || data.id !== job.conversationId || data.user_id !== job.scope.dataUserId || data.org_id !== job.scope.organizationId || data.deleted_at != null) {
    throw new Error('No se pudo verificar la conversación del workspace anterior.');
  }
}
