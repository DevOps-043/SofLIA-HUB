import {
  getProjects as irisGetProjects,
  getTeamMembersDetailed as irisGetTeamMembersDetailed,
  getTeams as irisGetTeams,
} from '../../iris-data-main';
import type { FunctionResponse } from '../types';
import { toolResponse } from '../types';
import { getIssues, getStatuses } from './read-issue-handlers';

export async function handleIrisReadTool(
  toolName: string,
  toolArgs: Record<string, any>,
): Promise<FunctionResponse | null> {
  if (toolName === 'iris_get_projects') return getProjects(toolName, toolArgs);
  if (toolName === 'iris_get_teams') return getTeams(toolName);
  if (toolName === 'iris_get_team_members') return getTeamMembers(toolName, toolArgs);
  if (toolName === 'iris_get_issues') return getIssues(toolName, toolArgs);
  if (toolName === 'iris_get_statuses') return getStatuses(toolName, toolArgs);
  return null;
}

async function getProjects(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse> {
  try {
    const projects = await irisGetProjects(toolArgs.team_id || toolArgs.team_name);
    const formatted = projects.map((project) => ({
      name: project.project_name,
      key: project.project_key,
      status: project.project_status,
      progress: project.completion_percentage,
      priority: project.priority_level,
      id: project.project_id,
      team_id: project.team_id || null,
    }));
    return toolResponse(toolName, { success: true, projects: formatted, count: formatted.length });
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}

async function getTeams(toolName: string): Promise<FunctionResponse> {
  try {
    const teams = await irisGetTeams();
    const formatted = teams.map((team) => ({
      name: team.name,
      slug: team.slug,
      status: team.status,
      id: team.team_id,
    }));
    return toolResponse(toolName, { success: true, teams: formatted, count: formatted.length });
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}

async function getTeamMembers(toolName: string, toolArgs: Record<string, any>): Promise<FunctionResponse> {
  const teamRef = toolArgs.team_id || toolArgs.team_name;
  if (!teamRef) {
    return toolResponse(toolName, {
      success: false,
      message: 'Debes indicar team_id o team_name para listar miembros del equipo.',
    });
  }

  try {
    const members = await irisGetTeamMembersDetailed(teamRef);
    const formatted = members.map((member) => ({
      user_id: member.user_id,
      display_name: member.display_name || member.username || member.email || member.user_id,
      email: member.email || null,
      username: member.username || null,
      role: member.role,
    }));
    return toolResponse(toolName, { success: true, members: formatted, count: formatted.length });
  } catch (err: any) {
    return toolResponse(toolName, { success: false, message: err.message });
  }
}
