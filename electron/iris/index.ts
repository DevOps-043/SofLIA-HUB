/**
 * API pública del paquete IRIS.
 *
 * Solo expone lo que el resto del codebase usa. Implementación encapsulada
 * en submódulos: types, clients, sessions, auth, teams, projects, issues,
 * statuses, priorities, resolvers, operations-read, operations-write,
 * whatsapp-context.
 */

// Types
export type {
  IrisIssue,
  IrisPriorityRecord,
  IrisProject,
  IrisStatusRecord,
  IrisTeam,
  IrisTeamMember,
  IrisTeamMemberDetail,
  ResolveResult,
  WhatsAppSession,
} from './types';

// Clients & availability
export { isIrisAvailable } from './clients';

// User sync
export { getSofiaUserByEmail } from './user-sync';

// Auth & sessions
export {
  authenticateWhatsAppUser,
  getAllWhatsAppSessions,
  getWhatsAppSession,
  logoutWhatsAppUser,
  tryAutoAuthByPhone,
} from './auth';

// Read operations (public — accept human refs)
export {
  getIssues,
  getProjects,
  getStatuses,
  getTeamMembers,
  getTeamMembersDetailed,
} from './operations-read';

// Direct entity readers (no resolution needed)
export { getTeams } from './teams';
export { getPriorities } from './priorities';

// Resolvers (used externally by some adapters)
export {
  resolveAssigneeReference,
  resolvePriorityReference,
  resolveProjectReference,
  resolveStatusReference,
} from './resolvers';

// Write operations
export {
  createIssue,
  createProject,
  updateIssueStatus,
  updateProjectStatus,
} from './operations-write';

// WhatsApp helpers
export { buildIrisContextForWhatsApp, needsIrisData } from './whatsapp-context';
