import { createClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';
import { verifyLegacyWorkspaceOwner } from '../background-teams/legacy-workspace-owner';
import type { BackgroundJob } from '../../src/shared/background-teams';

const scope = { userId: 'sofia', dataUserId: 'lia', organizationId: '11111111-1111-4111-8111-111111111111' };
const job = { conversationId: '22222222-2222-4222-8222-222222222222', scope } as BackgroundJob;
function fixture(rows: unknown[]) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } }));
  const client = createClient('https://lia.invalid', 'clave-de-prueba', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } });
  return { client, fetch };
}
it('ejecuta con el SDK real una consulta limitada por chat, propietario, organización y borrado', async () => {
  const { client, fetch } = fixture([{ id: job.conversationId, user_id: scope.dataUserId, org_id: scope.organizationId, deleted_at: null }]);
  const authorize = vi.fn(async () => {});
  await verifyLegacyWorkspaceOwner(client, job, authorize);
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(url.pathname).toBe('/rest/v1/conversations');
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ id: 'eq.' + job.conversationId, user_id: 'eq.lia', org_id: 'eq.' + scope.organizationId, deleted_at: 'is.null', limit: '1' });
  expect(authorize).toHaveBeenCalledTimes(2);
});
it.each([{ rows: [] }, { rows: [{ id: job.conversationId, user_id: 'otro', org_id: scope.organizationId, deleted_at: null }] }])('rechaza ausencia o propiedad incorrecta devuelta por el proveedor', async ({ rows }) => {
  const { client } = fixture(rows);
  await expect(verifyLegacyWorkspaceOwner(client, job, async () => {})).rejects.toThrow();
});
it('revoca la comprobación si cambia la identidad durante la lectura', async () => {
  const { client } = fixture([{ id: job.conversationId, user_id: scope.dataUserId, org_id: scope.organizationId, deleted_at: null }]);
  const authorize = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Sesión revocada'));
  await expect(verifyLegacyWorkspaceOwner(client, job, authorize)).rejects.toThrow('Sesión revocada');
});
