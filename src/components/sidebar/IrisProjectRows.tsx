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
        className={`min-h-8 w-full flex items-center gap-2 rounded-xl px-2 text-[12.5px] transition-all duration-200 cursor-pointer group/proj ${isExpanded ? 'bg-[#0A2540]/10 text-[#0A2540] font-semibold dark:bg-accent/10 dark:text-accent' : 'text-secondary dark:text-white/50 hover:bg-[#0A2540]/5 hover:text-[#0A2540] dark:hover:bg-white/[0.04] dark:hover:text-white/80'}`}
        onClick={() => props.onToggleProject(project.project_id)}
        onDoubleClick={() => props.onIrisProjectClick(project)}
        title={`${project.project_name} - ${project.project_status} (${project.completion_percentage}%)`}
      >
        <div className="h-2 w-2 rounded-full z-10 shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.08)]" style={{ backgroundColor: statusColor }} />
        <span className="flex-1 text-left truncate tracking-wide">{project.project_name}</span>
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-secondary opacity-0 transition-all group-hover/proj:opacity-100 dark:bg-white/[0.06] dark:text-white/40">{project.completion_percentage}%</span>
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
    <div className="ml-3 mt-1 space-y-0.5 border-l border-gray-200/60 pb-1 pl-2 dark:border-white/[0.06]">
      {issues.length === 0
        ? <p className="px-2 py-1 text-[10.5px] italic text-secondary/70 dark:text-white/30">Sin tareas</p>
        : issues.map((issue) => <IrisIssueButton key={issue.issue_id} issue={issue} onClick={() => onIssueClick(issue)} />)}
    </div>
  );
}

export function IrisIssueButton({ issue, onClick }: { issue: IrisIssue; onClick: () => void }) {
  const color = ISSUE_STATUS_TYPE_COLORS[issue.status?.status_type || 'backlog'] || '#6b7280';
  return (
    <button
      onClick={onClick}
      className="w-full flex min-h-7 items-center gap-2 rounded-xl px-2 text-[11px] text-secondary transition-colors hover:bg-[#0A2540]/5 hover:text-[#0A2540] group/issue dark:text-white/50 dark:hover:bg-white/[0.04] dark:hover:text-white/80"
      title={issue.title}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0 group-hover/issue:scale-125 transition-transform" style={{ backgroundColor: color }} />
      <span className="shrink-0 tabular-nums text-secondary/70 dark:text-white/30">#{issue.issue_number}</span>
      <span className="flex-1 text-left truncate font-medium tracking-wide">{issue.title}</span>
    </button>
  );
}
