import { supabase } from '../lib/supabase';
import { projectHubApi } from './project-hub-api';
import { readProjectChatBinding } from './project-chat-binding';
import { decorateOwnedFolder } from './folder/normalizers';
import type { Folder } from './folder-service';

interface Input { workspaceId: string; projectId: string; userId: string; orgId: string; name: string; create: boolean; signal: AbortSignal }
const fields = 'id,user_id,org_id,name,description,created_at,updated_at';
// El identificador permite recuperar la misma carpeta personal sin tablas ni cachés de vínculos.
async function personalId(input: Input) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['soflia-project-chat-v1', input.userId, input.orgId, input.workspaceId, input.projectId]))));
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.subarray(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function resolveProjectChatSpace(input: Input): Promise<Folder | null> {
  const assert = () => { if (input.signal.aborted) throw new Error('La selección del proyecto cambió.'); };
  assert();
  // Un vínculo federado previo conserva sus chats y permisos; no se reemplaza por nombre.
  const bound = await readProjectChatBinding(input.workspaceId, input.projectId, input.signal); assert();
  if (bound) {
    const result = await supabase.from('folders').select(fields).eq('id', bound).eq('org_id', input.orgId).abortSignal(input.signal).maybeSingle(); assert();
    if (result.error || !result.data) throw new Error('No tienes acceso al espacio de chats vinculado.');
    const folder = result.data as Folder;
    if (folder.user_id === input.userId) return decorateOwnedFolder(folder);
    const shared = await supabase.from('folder_shares').select('permission').eq('folder_id', folder.id).eq('shared_with_user_id', input.userId).eq('is_active', true).is('revoked_at', null).abortSignal(input.signal).maybeSingle(); assert();
    if (shared.error || !shared.data) throw new Error('No tienes acceso al espacio de chats compartido.');
    return { ...folder, is_shared: true, can_edit: shared.data.permission === 'edit', can_share: false };
  }
  const id = await personalId(input); assert();
  const read = () => supabase.from('folders').select(fields).eq('id', id).eq('user_id', input.userId).eq('org_id', input.orgId).abortSignal(input.signal).maybeSingle();
  const result = await read(); assert();
  if (result.error) throw new Error('No se pudieron consultar tus chats. Comprueba la conexión e inténtalo de nuevo.');
  if (result.data) return decorateOwnedFolder(result.data);
  if (!input.create) return null;
  const project = await projectHubApi.getProject(input.workspaceId, input.projectId); assert();
  const role = project.data?.role ?? project.data?.membership?.project_role;
  if (!project.success || project.data?.project_id !== input.projectId || project.data?.workspace_id !== input.workspaceId || !['owner', 'admin', 'member'].includes(role || '')) throw new Error('No tienes permiso para crear chats en este proyecto.');
  const inserted = await supabase.from('folders').insert({ id, user_id: input.userId, org_id: input.orgId, name: project.data.project_name.slice(0, 255) }).select(fields).abortSignal(input.signal).single(); assert();
  if (!inserted.error && inserted.data) return decorateOwnedFolder(inserted.data);
  // Dos ventanas pueden iniciar el mismo espacio: releer, sin insertar otra carpeta.
  const existing = await read(); assert();
  if (existing.error || !existing.data) throw new Error('No se confirmó la creación del espacio de chats. Actualiza antes de repetir.');
  return decorateOwnedFolder(existing.data);
}
