import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type OutboxEnvelope = {
  event_id: string;
  workspace_id: string;
  project_id: string | null;
  event_type: 'project.chat_binding.requested' | 'project.member.upserted' | 'project.member.removed';
  idempotency_key: string;
  payload: Record<string, unknown>;
};

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return respond(405, { code: 'method_not_allowed' });
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-project-hub-timestamp') || '';
  const signature = request.headers.get('x-project-hub-signature') || '';
  const secret = Deno.env.get('PROJECT_HUB_OUTBOX_HMAC_SECRET') || '';
  if (!await validSignature(timestamp, signature, rawBody, secret)) {
    return respond(401, { code: 'invalid_signature' });
  }

  try {
    const event = JSON.parse(rawBody) as OutboxEnvelope;
    if (!event.event_id || !event.project_id || !event.event_type || !event.payload) {
      return respond(400, { code: 'invalid_event' });
    }
    const liaUrl = Deno.env.get('SUPABASE_URL') || '';
    const adminKey = getAdminKey();
    if (!liaUrl || !adminKey) return respond(503, { code: 'service_unavailable' });
    const admin = createClient(liaUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });

    if (event.event_type === 'project.chat_binding.requested') {
      await ensureProjectFolder(admin, event);
    } else {
      await synchronizeMember(admin, event);
    }
    return respond(200, { data: { event_id: event.event_id, applied: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'outbox_apply_failed';
    console.error('[project-hub-outbox]', message);
    const status = message === 'binding_not_ready' || message === 'identity_not_verified' ? 409 : 500;
    return respond(status, { code: message });
  }
});

async function ensureProjectFolder(admin: ReturnType<typeof createClient>, event: OutboxEnvelope) {
  const { data: existing, error: bindingReadError } = await admin.from('project_chat_bindings')
    .select('binding_id').eq('iris_project_id', event.project_id).maybeSingle();
  if (bindingReadError) throw new Error('binding_read_failed');
  if (existing) return;

  const owner = await resolveLiaUser(admin, String(event.payload.owner_user_id || ''));
  const { data: folder, error: folderError } = await admin.from('folders').insert({
    user_id: owner,
    name: String(event.payload.project_name || 'Proyecto'),
    description: 'Carpeta colaborativa administrada por Project Hub',
    org_id: event.payload.sofia_org_id || null,
  }).select('id').single();
  if (folderError || !folder) throw new Error('folder_create_failed');

  const { error: bindingError } = await admin.from('project_chat_bindings').insert({
    iris_workspace_id: event.workspace_id,
    iris_project_id: event.project_id,
    lia_folder_id: folder.id,
    created_by_lia_user_id: owner,
    binding_status: 'active',
    last_error: null,
  });
  if (bindingError) throw new Error('binding_create_failed');
}

async function synchronizeMember(admin: ReturnType<typeof createClient>, event: OutboxEnvelope) {
  const { data: binding, error: bindingError } = await admin.from('project_chat_bindings')
    .select('binding_id,lia_folder_id,created_by_lia_user_id').eq('iris_project_id', event.project_id).maybeSingle();
  if (bindingError) throw new Error('binding_read_failed');
  if (!binding) throw new Error('binding_not_ready');
  const memberId = await resolveLiaUser(admin, String(event.payload.user_id || ''));

  if (event.event_type === 'project.member.upserted' && event.payload.role === 'owner') {
    const previousOwner = binding.created_by_lia_user_id;
    const { error: folderOwnerError } = await admin.from('folders').update({ user_id: memberId })
      .eq('id', binding.lia_folder_id);
    if (folderOwnerError) throw new Error('folder_owner_transfer_failed');
    const { error: bindingOwnerError } = await admin.from('project_chat_bindings').update({
      created_by_lia_user_id: memberId, updated_at: new Date().toISOString(),
    }).eq('binding_id', binding.binding_id);
    if (bindingOwnerError) throw new Error('binding_owner_transfer_failed');
    if (previousOwner !== memberId) {
      await upsertFolderShare(admin, binding.lia_folder_id, memberId, previousOwner,
        event.payload.sofia_org_id || null, 'edit');
    }
    return;
  }
  if (memberId === binding.created_by_lia_user_id) return;

  const { data: shares, error: shareReadError } = await admin.from('folder_shares').select('id')
    .eq('folder_id', binding.lia_folder_id).eq('shared_with_user_id', memberId)
    .order('created_at', { ascending: false });
  if (shareReadError) throw new Error('share_read_failed');

  if (event.event_type === 'project.member.removed') {
    if (!shares?.length) return;
    const { error } = await admin.from('folder_shares').update({
      is_active: false, revoked_at: new Date().toISOString(),
    }).in('id', shares.map((share: { id: string }) => share.id));
    if (error) throw new Error('share_revoke_failed');
    return;
  }

  const permission = event.payload.access === 'read' ? 'view' : 'edit';
  if (shares?.length) {
    const { error } = await admin.from('folder_shares').update({
      permission, is_active: true, revoked_at: null,
    }).eq('id', shares[0].id);
    if (error) throw new Error('share_update_failed');
    return;
  }
  await upsertFolderShare(admin, binding.lia_folder_id, binding.created_by_lia_user_id,
    memberId, event.payload.sofia_org_id || null, permission);
}

async function upsertFolderShare(
  admin: ReturnType<typeof createClient>,
  folderId: string,
  sharedBy: string,
  sharedWith: string,
  organizationId: unknown,
  permission: 'view' | 'edit',
) {
  const { data: existing, error: readError } = await admin.from('folder_shares').select('id')
    .eq('folder_id', folderId).eq('shared_with_user_id', sharedWith)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (readError) throw new Error('share_read_failed');
  if (existing) {
    const { error } = await admin.from('folder_shares').update({
      shared_by: sharedBy, permission, is_active: true, revoked_at: null,
    }).eq('id', existing.id);
    if (error) throw new Error('share_update_failed');
    return;
  }
  const { error } = await admin.from('folder_shares').insert({
    folder_id: folderId, shared_by: sharedBy, shared_with_user_id: sharedWith,
    org_id: organizationId, permission, is_active: true,
  });
  if (error) throw new Error('share_create_failed');
}

async function resolveLiaUser(admin: ReturnType<typeof createClient>, sofiaUserId: string): Promise<string> {
  if (!sofiaUserId) throw new Error('identity_not_verified');
  const { data, error } = await admin.from('federated_identities').select('lia_user_id')
    .eq('sofia_user_id', sofiaUserId).maybeSingle();
  if (error || !data?.lia_user_id) throw new Error('identity_not_verified');
  return data.lia_user_id;
}

async function validSignature(timestamp: string, signature: string, body: string, secret: string): Promise<boolean> {
  const numericTimestamp = Number(timestamp);
  if (!secret || !signature || !Number.isFinite(numericTimestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - numericTimestamp) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expectedBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`${timestamp}.${body}`)));
  const expected = [...expectedBytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

function getAdminKey(): string {
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (direct) return direct;
  try {
    return (JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>).default || '';
  } catch { return ''; }
}

function respond(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
