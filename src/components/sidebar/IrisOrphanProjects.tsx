import { PROJECT_STATUS_COLORS } from '../../services/iris-data';
import type { SidebarProps } from './types';
import { ChevronIcon } from './ChevronIcon';
import { IrisIssuesList } from './IrisProjectRows';
import { SidebarSectionLabel } from './SidebarSectionLabel';

export function IrisOrphanProjects({ props }: { props: SidebarProps }) {
  const orphans = props.irisProjects.filter(
    (project) => !project.team_id || !props.irisTeams.some((team) => team.team_id === project.team_id),
  );
  if (orphans.length === 0) return null;

  return (
    <div className="mt-1">
      {props.isOpen && <SidebarSectionLabel label="Globales" />}
      {orphans.map((project) => {
        const expanded = props.expandedProjects.has(project.project_id);
        return (
          <div key={project.project_id} className="mb-0.5">
            <div
              className={`min-h-9 w-full flex items-center ${props.isOpen ? 'gap-2 px-2' : 'justify-center px-0'} rounded-2xl text-[13px] transition-all duration-200 cursor-pointer group/proj ${expanded ? 'bg-gray-100/80 text-[#0A2540] font-semibold dark:bg-white/[0.05] dark:text-white' : 'text-secondary dark:text-white/50 hover:bg-[#0A2540]/5 hover:text-[#0A2540] dark:hover:bg-white/[0.05] dark:hover:text-white/80'}`}
              onClick={() => props.onToggleProject(project.project_id)}
              onDoubleClick={() => props.onIrisProjectClick(project)}
              title={`${project.project_name} - ${project.project_status}`}
            >
              {props.isOpen && <ChevronIcon className={`h-3 w-3 shrink-0 text-secondary/70 opacity-50 transition-all duration-200 group-hover/proj:opacity-100 dark:text-white/40 ${expanded ? 'rotate-90 opacity-100' : ''}`} />}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[inset_0_0_0_1px_rgba(10,37,64,0.08)] dark:bg-white/[0.04] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLORS[project.project_status] || '#6b7280' }} />
              </div>
              {props.isOpen && (
                <>
                  <span className="flex-1 text-left truncate tracking-wide">{project.project_name}</span>
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-secondary opacity-0 transition-opacity group-hover/proj:opacity-100 dark:bg-white/[0.06] dark:text-white/40">{project.completion_percentage}%</span>
                </>
              )}
            </div>
            {expanded && props.isOpen && (
              <IrisIssuesList issues={props.irisIssues[project.project_id] || []} onIssueClick={props.onIrisIssueClick} />
            )}
          </div>
        );
      })}
    </div>
  );
}
