import { PROJECT_STATUS_COLORS } from '../../services/iris-data';
import type { SidebarProps } from './types';
import { ChevronIcon } from './ChevronIcon';
import { IrisIssuesList } from './IrisProjectRows';

export function IrisOrphanProjects({ props }: { props: SidebarProps }) {
  const orphans = props.irisProjects.filter(
    (project) => !project.team_id || !props.irisTeams.some((team) => team.team_id === project.team_id),
  );
  if (orphans.length === 0) return null;

  return (
    <div className="mt-2 pl-1">
      {props.isOpen && (
        <div className="px-3 py-1 mb-1">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">WorkSpaces Globales</span>
        </div>
      )}
      {orphans.map((project) => {
        const expanded = props.expandedProjects.has(project.project_id);
        return (
          <div key={project.project_id} className="mb-0.5">
            <div
              className={`w-full flex items-center ${props.isOpen ? 'gap-2.5 px-3' : 'justify-center px-0'} py-1.5 rounded-md text-[13px] transition-all duration-200 cursor-pointer group/proj ${expanded ? 'bg-gray-100/50 dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100/30 dark:hover:bg-white/[0.02] hover:text-gray-900 dark:hover:text-gray-200'}`}
              onClick={() => props.onToggleProject(project.project_id)}
              onDoubleClick={() => props.onIrisProjectClick(project)}
              title={`${project.project_name} - ${project.project_status}`}
            >
              {props.isOpen && <ChevronIcon className={`h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover/proj:opacity-100 transition-all duration-200 ${expanded ? 'rotate-90 opacity-100' : ''}`} />}
              <div className="flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-[4px] border border-gray-200/50 dark:border-white/10 bg-white dark:bg-white/5 shadow-none">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLORS[project.project_status] || '#6b7280' }} />
              </div>
              {props.isOpen && (
                <>
                  <span className="flex-1 text-left truncate tracking-wide">{project.project_name}</span>
                  <span className="text-[10px] text-gray-400 px-1 py-0.5 opacity-0 group-hover/proj:opacity-100 transition-opacity">{project.completion_percentage}%</span>
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
