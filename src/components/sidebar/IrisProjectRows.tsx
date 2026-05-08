import type { IrisIssue, IrisProject } from '../../lib/iris-client';
import { ISSUE_STATUS_TYPE_COLORS, PROJECT_STATUS_COLORS } from '../../services/iris-data';
import type { SidebarProps } from './types';

export function IrisProjectRow({ props, project }: { props: SidebarProps; project: IrisProject }) {
  const issues = props.irisIssues[project.project_id] || [];
  const isExpanded = props.expandedProjects.has(project.project_id);
  const statusColor = PROJECT_STATUS_COLORS[project.project_status] || '#6b7280';

  return (
    <div className="relative mt-0.5">
      <div
        className={`w-full flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-r-md text-[12.5px] transition-all duration-200 cursor-pointer group/proj ${isExpanded ? 'text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-white/[0.02]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.01]'}`}
        onClick={() => props.onToggleProject(project.project_id)}
        onDoubleClick={() => props.onIrisProjectClick(project)}
        title={`${project.project_name} - ${project.project_status} (${project.completion_percentage}%)`}
      >
        <div className="absolute left-0 top-[14px] w-2.5 h-px bg-gray-100 dark:bg-white/5 group-hover/proj:bg-gray-300 dark:group-hover/proj:bg-white/20 transition-colors" />
        <div className="w-1.5 h-1.5 rounded-full z-10 shrink-0" style={{ backgroundColor: statusColor }} />
        <span className="flex-1 text-left truncate tracking-wide">{project.project_name}</span>
        <span className="text-[9px] px-1 py-0.5 rounded border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-0 group-hover/proj:opacity-100 transition-all font-medium">{project.completion_percentage}%</span>
      </div>
      {isExpanded && <IrisIssuesList issues={issues} onIssueClick={props.onIrisIssueClick} />}
    </div>
  );
}

export function IrisIssuesList({
  issues,
  onIssueClick,
}: {
  issues: IrisIssue[];
  onIssueClick: (issue: IrisIssue) => void;
}) {
  return (
    <div className="ml-4 mt-0.5 pb-1 space-y-0.5 border-l border-gray-100 dark:border-white/5">
      {issues.length === 0
        ? <p className="pl-3 py-1 text-[10.5px] text-gray-400 dark:text-gray-500 italic">Sin tareas</p>
        : issues.map((issue) => <IrisIssueButton key={issue.issue_id} issue={issue} onClick={() => onIssueClick(issue)} />)}
    </div>
  );
}

export function IrisIssueButton({ issue, onClick }: { issue: IrisIssue; onClick: () => void }) {
  const color = ISSUE_STATUS_TYPE_COLORS[issue.status?.status_type || 'backlog'] || '#6b7280';
  return (
    <button
      onClick={onClick}
      className="relative w-full flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-r-md text-[11px] transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.02] group/issue"
      title={issue.title}
    >
      <div className="absolute left-0 top-[11px] w-2 h-px bg-gray-100 dark:bg-white/5 group-hover/issue:bg-gray-300 dark:group-hover/issue:bg-white/20 transition-colors" />
      <span className="w-1.5 h-1.5 rounded-full shrink-0 group-hover/issue:scale-125 transition-transform" style={{ backgroundColor: color }} />
      <span className="text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">#{issue.issue_number}</span>
      <span className="flex-1 text-left truncate font-medium tracking-wide">{issue.title}</span>
    </button>
  );
}
