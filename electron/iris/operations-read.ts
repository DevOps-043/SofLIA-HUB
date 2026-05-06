/**
 * Operaciones de lectura públicas — aceptan refs humanas (teamRef) y delegan
 * a los repositorios raw después de resolver la referencia.
 *
 * Este es el contrato que consume el agente WhatsApp: nombres, slugs o IDs
 * todos producen el mismo resultado.
 */

import { fetchProjectsByTeamId } from './projects';
import { resolveTeamReference } from './resolvers';
import { fetchStatusesByTeamId } from './statuses';
import {
  fetchTeamMembersByTeamId,
  fetchTeamMembersDetailedByTeamId,
} from './teams';
import type {
  IrisProject,
  IrisStatusRecord,
  IrisTeamMember,
  IrisTeamMemberDetail,
} from './types';

export async function getProjects(teamRef?: string): Promise<IrisProject[]> {
  let resolvedTeamId: string | null = null;

  if (teamRef?.trim()) {
    const teamResult = await resolveTeamReference(
      { teamId: teamRef, teamName: teamRef },
      {
        allowSingleTeamDefault: false,
        missingMessage: 'No encontre el equipo solicitado para filtrar proyectos.',
      },
    );
    if (!teamResult.success) {
      console.warn('[IRIS-Main] getProjects team resolution failed:', teamResult.error);
      return [];
    }
    resolvedTeamId = teamResult.value.team_id;
  }

  return fetchProjectsByTeamId(resolvedTeamId);
}

export async function getTeamMembers(teamRef: string): Promise<IrisTeamMember[]> {
  const teamResult = await resolveTeamReference(
    { teamId: teamRef, teamName: teamRef },
    {
      allowSingleTeamDefault: false,
      missingMessage: 'No encontre el equipo solicitado para listar miembros.',
    },
  );
  if (!teamResult.success) {
    console.warn('[IRIS-Main] getTeamMembers team resolution failed:', teamResult.error);
    return [];
  }
  return fetchTeamMembersByTeamId(teamResult.value.team_id);
}

export async function getTeamMembersDetailed(teamRef: string): Promise<IrisTeamMemberDetail[]> {
  const teamResult = await resolveTeamReference(
    { teamId: teamRef, teamName: teamRef },
    {
      allowSingleTeamDefault: false,
      missingMessage: 'No encontre el equipo solicitado para listar miembros.',
    },
  );
  if (!teamResult.success) {
    console.warn(
      '[IRIS-Main] getTeamMembersDetailed team resolution failed:',
      teamResult.error,
    );
    return [];
  }
  return fetchTeamMembersDetailedByTeamId(teamResult.value.team_id);
}

export async function getStatuses(teamRef: string): Promise<IrisStatusRecord[]> {
  const teamResult = await resolveTeamReference(
    { teamId: teamRef, teamName: teamRef },
    {
      allowSingleTeamDefault: false,
      missingMessage: 'No encontre el equipo solicitado para listar estados.',
    },
  );
  if (!teamResult.success) {
    console.warn('[IRIS-Main] getStatuses team resolution failed:', teamResult.error);
    return [];
  }
  return fetchStatusesByTeamId(teamResult.value.team_id);
}

// Re-export para conveniencia: getIssues no necesita resolver refs (ya recibe IDs).
export { fetchIssues as getIssues } from './issues';
