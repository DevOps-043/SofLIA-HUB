import type { SofiaOrganization } from '../../lib/sofia-client';
import type { SofiaContext } from '../sofia-auth';

/** Sólo incorpora una confirmación a la sesión que la originó, sin cambiar la selección. */
export function mergeOrganizationProfile(context: SofiaContext | null, organization: SofiaOrganization, actorId: string): SofiaContext | null {
  if (!context?.user || context.user.id !== actorId || !context.memberships.some(m =>
    m.organization_id === organization.id && m.user_id === actorId && m.status === 'active' && (m.role === 'owner' || m.role === 'admin'))) return context;
  const organizations = context.organizations.map(org => org.id === organization.id ? organization : org);
  const memberships = context.memberships.map(m => m.organization_id === organization.id ? { ...m, organization } : m);
  return { ...context, organizations, memberships,
    user: { ...context.user, organizations, memberships },
    currentOrganization: context.currentOrganization?.id === organization.id ? organization : context.currentOrganization,
  };
}
