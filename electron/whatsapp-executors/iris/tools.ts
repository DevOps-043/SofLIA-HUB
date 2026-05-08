export const IRIS_TOOLS = new Set([
  'iris_login',
  'iris_logout',
  'iris_get_my_tasks',
  'iris_get_projects',
  'iris_get_teams',
  'iris_get_team_members',
  'iris_get_issues',
  'iris_get_statuses',
  'iris_create_task',
  'iris_update_task_status',
  'iris_create_project',
  'iris_update_project_status',
]);

export function isIrisTool(name: string): boolean {
  return IRIS_TOOLS.has(name);
}
