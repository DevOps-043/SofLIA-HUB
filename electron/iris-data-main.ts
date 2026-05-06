/**
 * Barrel re-export del paquete `./iris`.
 *
 * Este archivo existe para preservar los imports históricos
 * (`from './iris-data-main'`). La implementación real vive en submódulos
 * cohesivos dentro de `./iris/`. Cualquier código nuevo debería importar
 * directamente de `./iris` en lugar de este archivo.
 */

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
} from './iris';

export {
  authenticateWhatsAppUser,
  buildIrisContextForWhatsApp,
  createIssue,
  createProject,
  getAllWhatsAppSessions,
  getIssues,
  getPriorities,
  getProjects,
  getSofiaUserByEmail,
  getStatuses,
  getTeamMembers,
  getTeamMembersDetailed,
  getTeams,
  getWhatsAppSession,
  isIrisAvailable,
  logoutWhatsAppUser,
  needsIrisData,
  resolveAssigneeReference,
  resolvePriorityReference,
  resolveProjectReference,
  resolveStatusReference,
  tryAutoAuthByPhone,
  updateIssueStatus,
  updateProjectStatus,
} from './iris';
