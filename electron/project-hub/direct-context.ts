import type { SupabaseClient } from '@supabase/supabase-js';
import { captureProjectHubIdentity, type ProjectHubOperationAuthorization, type ProjectHubSessionLease } from './session-context';
import { ProjectHubError } from './session-contract';
import type { ProjectHubWorkspace } from './types';
import { getOrganizationContext } from '../main/organization-context';

export type ProjectRow = Record<string, unknown>;
/** Learning es la autoridad del rol organizativo; el espejo local no lo eleva. */
function organizationRole(role: string): string { return ['owner', 'admin'].includes(role) ? role : 'member'; }
export interface DirectProjectDependencies {
  clients(): Promise<{ iris: SupabaseClient | null; sofia: SupabaseClient | null }>;
  identity(): Promise<string | null>;
  selection(): Promise<{ userId: string | null; organizationId: string | null; revision: number }>;
  currentScope?(): { userId: string | null; organizationId: string | null; revision: number };
}
export const directProjectDependencies: DirectProjectDependencies = {
  clients: async () => { const clients = await import('../iris/clients'); return { iris: clients.getIrisClient(), sofia: clients.getSofiaClient() }; },
  identity: async () => (await import('../main/sofia-session')).getSofiaSessionUserId(),
  selection: async () => getOrganizationContext(),
  currentScope: getOrganizationContext,
};
export interface DirectProjectContext extends ProjectHubSessionLease {
  iris: SupabaseClient;
  sofia: SupabaseClient;
  organizationId: string;
  actorId: string;
  workspace: ProjectHubWorkspace;
  role: string;
  check(): Promise<void>;
  effects?: boolean;
  writePending?: boolean;
  writeTarget?: { projectId: string; access: 'write' | 'admin' };
}

export async function directWrite<T>(operation: PromiseLike<{ data: T; error: { code?: string } | null }>, context: DirectProjectContext): Promise<T> {
  await context.check();
  const learning = await directData(context.sofia.from('organization_users').select('role').eq('organization_id', context.organizationId).eq('user_id', context.userId).eq('status', 'active').maybeSingle(), context);
  const member = await directData(context.iris.from('workspace_members').select('iris_role,is_active').eq('workspace_id', context.workspace.id).eq('user_id', context.actorId).eq('is_active', true).maybeSingle(), context);
  if (!learning || !member) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'Tu acceso a esta organización cambió. Actualiza antes de continuar.');
  context.role = organizationRole(learning.role);
  if (context.writeTarget) await directProject(context, context.workspace.id, context.writeTarget.projectId, context.writeTarget.access);
  await context.check(); context.writePending = true;
  const result = await operation;
  if (result.error?.code) context.writePending = false;
  const data = await directData(Promise.resolve(result), context);
  context.effects = true; context.writePending = false; return data;
}

export async function directData<T>(operation: PromiseLike<{ data: T; error: { code?: string } | null }>, context: { check(): Promise<void> }): Promise<T> {
  await context.check(); const result = await operation; await context.check();
  if (result.error) {
    if (result.error.code === '23505') throw new ProjectHubError('CONFLICT', 'Ya existe un registro con esos datos. Actualiza antes de repetir.');
    if (result.error.code === 'PT401') throw new ProjectHubError('NOT_AUTHENTICATED', 'Inicia sesión en Learning para acceder a los proyectos.');
    if (result.error.code === 'PT403') throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'No tienes una membresía activa en esta organización.');
    if (result.error.code === 'PT503') throw new ProjectHubError('DATABASE_UNAVAILABLE', 'No se pudo comprobar el acceso al proyecto. Inténtalo de nuevo.');
    if (result.error.code === '42501') throw new ProjectHubError('DATABASE_FORBIDDEN', 'La base de datos no permite esta operación con la sesión actual.');
    if (['42P01', '42703', 'PGRST202', 'PGRST204'].includes(result.error.code || '')) throw new ProjectHubError('DATABASE_SCHEMA_UNAVAILABLE', 'La base de datos no dispone del contrato requerido para esta operación.');
    throw new ProjectHubError('DATABASE_UNAVAILABLE', 'No se pudo completar la operación en la base de datos de proyectos.');
  }
  return result.data;
}

/** La selección no concede permisos: se valida también en SOFIA con su sesión vigente. */
export async function captureDirectProjectContext(dependencies: DirectProjectDependencies, authorization?: ProjectHubOperationAuthorization): Promise<DirectProjectContext> {
  const lease = captureProjectHubIdentity(new AbortController().signal, () => {}, authorization);
  try {
    const selected = await dependencies.selection();
    const verifiedId = await dependencies.identity(); lease.assert();
    if (verifiedId !== lease.userId) throw new ProjectHubError('SOFIA_SESSION_PENDING', 'Inicia sesión en Learning para acceder a los proyectos.');
    if (selected.userId !== lease.userId || !selected.organizationId) throw new ProjectHubError('ORGANIZATION_REQUIRED', 'Selecciona una organización para acceder a sus proyectos.');
    const assert = () => {
      lease.assert();
      const current = dependencies.currentScope?.();
      if (current && (current.revision !== selected.revision || current.userId !== selected.userId || current.organizationId !== selected.organizationId)) throw new ProjectHubError('SESSION_CHANGED', 'La organización cambió durante la operación.');
    };
    const check = async () => {
      assert();
      const current = await dependencies.selection();
      if (current.revision !== selected.revision || current.userId !== lease.userId || current.organizationId !== selected.organizationId || await dependencies.identity() !== lease.userId) throw new ProjectHubError('SESSION_CHANGED', 'La sesión o la organización cambió. Actualiza los proyectos.');
      assert();
    };
    const { iris, sofia } = await dependencies.clients(); await check();
    if (!iris || !sofia) throw new ProjectHubError('NOT_CONFIGURED', 'La conexión directa a la base de datos de proyectos no está disponible.');
    const guard = { check };
    const membership = await directData(sofia.from('organization_users').select('role').eq('organization_id', selected.organizationId).eq('user_id', lease.userId).eq('status', 'active').maybeSingle(), guard);
    if (!membership) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'No tienes una membresía activa en esta organización.');
    const organization = await directData(sofia.from('organizations').select('id,name,slug,logo_url').eq('id', selected.organizationId).eq('is_active', true).maybeSingle(), guard);
    if (!organization) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'La organización no está disponible.');
    let workspace = await directData(iris.from('workspaces').select('workspace_id,name,slug,is_active').eq('sofia_org_id', selected.organizationId).maybeSingle(), guard);
    if (!workspace) {
      // Misma sincronización de identidad organizativa, sin pasar por el servidor web.
      workspace = await directData(iris.from('workspaces').upsert({ sofia_org_id: selected.organizationId, name: organization.name, slug: organization.slug, logo_url: organization.logo_url, is_active: true }, { onConflict: 'sofia_org_id', ignoreDuplicates: true }).select('workspace_id,name,slug,is_active').maybeSingle(), guard);
      if (!workspace) workspace = await directData(iris.from('workspaces').select('workspace_id,name,slug,is_active').eq('sofia_org_id', selected.organizationId).maybeSingle(), guard);
    }
    if (!workspace || workspace.is_active !== true) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'El espacio de esta organización no está activo.');
    let account = await directData(iris.from('account_users').select('user_id,sofia_user_id').eq('sofia_user_id', lease.userId).maybeSingle(), guard);
    if (!account) account = await directData(iris.from('account_users').select('user_id,sofia_user_id').eq('user_id', lease.userId).maybeSingle(), guard);
    if (account?.sofia_user_id && account.sofia_user_id !== lease.userId) throw new ProjectHubError('NOT_AUTHENTICATED', 'La identidad del espacio no coincide con Learning.');
    if (!account) {
      const profile = await directData(sofia.from('users').select('id,username,email,first_name,last_name,display_name').eq('id', lease.userId).maybeSingle(), guard);
      if (!profile) throw new ProjectHubError('NOT_AUTHENTICATED', 'No se pudo comprobar el perfil de Learning.');
      const { mapSofiaUserToIrisAccountUser } = await import('../iris/user-sync/user-mapper');
      await directData(iris.from('account_users').upsert({ ...mapSofiaUserToIrisAccountUser(profile), sofia_user_id: lease.userId }, { onConflict: 'user_id', ignoreDuplicates: true }), guard);
      account = await directData(iris.from('account_users').select('user_id').eq('user_id', lease.userId).maybeSingle(), guard);
    }
    if (!account?.user_id) throw new ProjectHubError('NOT_AUTHENTICATED', 'No se pudo comprobar la identidad del proyecto.');
    const mirrored = await directData(iris.from('workspace_members').select('iris_role,is_active').eq('workspace_id', workspace.workspace_id).eq('user_id', account.user_id).maybeSingle(), guard);
    if (mirrored && mirrored.is_active !== true) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'Tu acceso a este espacio está desactivado.');
    let currentMember = mirrored;
    if (!currentMember) {
      await directData(iris.from('workspace_members').upsert({ workspace_id: workspace.workspace_id, user_id: account.user_id, sofia_role: membership.role, iris_role: organizationRole(membership.role), is_active: true }, { onConflict: 'workspace_id,user_id', ignoreDuplicates: true }), guard);
      currentMember = await directData(iris.from('workspace_members').select('iris_role,is_active').eq('workspace_id', workspace.workspace_id).eq('user_id', account.user_id).maybeSingle(), guard);
    }
    if (!currentMember || currentMember.is_active !== true) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'No se pudo comprobar la membresía del espacio de esta organización.');
    const role = organizationRole(membership.role);
    return { ...lease, assert, iris, sofia, organizationId: selected.organizationId, actorId: account.user_id, workspace: { id: workspace.workspace_id, name: workspace.name, slug: workspace.slug, role }, role, check };
  } catch (error) { lease.dispose(); throw error; }
}

export async function directProject(context: DirectProjectContext, workspaceId: string, projectId: string, access: 'read' | 'write' | 'admin' = 'read') {
  await context.check();
  if (workspaceId !== context.workspace.id) throw new ProjectHubError('WORKSPACE_FORBIDDEN', 'El proyecto no pertenece a la organización activa.');
  const project = await directData(context.iris.from('pm_projects').select('*').eq('workspace_id', workspaceId).eq('project_id', projectId).maybeSingle(), context);
  if (!project) throw new ProjectHubError('NOT_FOUND', 'No se encontró el proyecto en esta organización.');
  const membership = await directData(context.iris.from('pm_project_members').select('project_role,membership_status').eq('project_id', projectId).eq('user_id', context.actorId).eq('membership_status', 'active').maybeSingle(), context);
  const role = ['owner', 'admin'].includes(context.role) ? 'admin' : project.created_by_user_id === context.actorId ? 'owner' : membership?.project_role;
  if (!role || (access !== 'read' && ['viewer', 'guest'].includes(role)) || (access === 'admin' && !['owner', 'admin'].includes(role))) throw new ProjectHubError('PROJECT_FORBIDDEN', 'No tienes permiso para esta operación en el proyecto.');
  return { ...project, role, membership: { project_role: role } } as ProjectRow & { role: string; team_id: string | null };
}
