import type { TaskData } from './types';

export async function collectUrgentTasks(session: any): Promise<TaskData[]> {
  const { getIssues, getProjects } = await import('../iris-data-main');
  const todayStr = new Date().toISOString().split('T')[0];
  const allIssues = await getIssues({ assigneeId: session.userId, limit: 50 });
  const projects = await getProjects();
  const projectMap = new Map(projects.map((project: any) => [project.project_id, project.project_name]));
  const urgentTasks: TaskData[] = [];

  for (const issue of allIssues) {
    const statusType = issue.status?.status_type?.toLowerCase() || '';
    if (statusType === 'done' || statusType === 'cancelled' || statusType === 'completed') continue;
    if (!issue.due_date) continue;

    const dueDate = issue.due_date.split('T')[0];
    const isOverdue = dueDate < todayStr;
    const isDueToday = dueDate === todayStr;
    if (!isOverdue && !isDueToday) continue;

    urgentTasks.push({
      title: issue.title,
      status: issue.status?.name || 'Sin estado',
      priority: issue.priority?.name,
      dueDate: issue.due_date,
      projectName: issue.project_id ? projectMap.get(issue.project_id) : undefined,
      isOverdue,
      isDueToday,
    });
  }

  return urgentTasks;
}
