import type { IrisProject, IrisTeam } from '../../lib/iris-client';
import type { SidebarProps } from './types';
import { ChevronIcon } from './ChevronIcon';
import { IrisProjectRow } from './IrisProjectRows';

export function IrisTeamRow({
  props,
  team,
  projects,
  isExpanded,
}: {
  props: SidebarProps;
  team: IrisTeam;
  projects: IrisProject[];
  isExpanded: boolean;
}) {
  const { isOpen } = props;
  return (
    <div className="mb-0.5">
      <div
        className={`w-full flex items-center ${isOpen ? 'gap-2.5 px-3' : 'justify-center px-0'} py-1.5 rounded-md text-[13px] transition-all duration-200 cursor-pointer group ${isExpanded ? 'bg-gray-100/50 dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100/30 dark:hover:bg-white/[0.02] hover:text-gray-900 dark:hover:text-gray-200'}`}
        onClick={() => props.onToggleTeam(team.team_id)}
        title={team.name}
      >
        {isOpen && <ChevronIcon className={`h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 ${isExpanded ? 'rotate-90 opacity-100' : ''}`} />}
        <div className="flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-[4px] text-[10px] font-bold text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10" style={{ backgroundColor: team.color || '#3b82f6' }}>
          {team.name ? team.name.charAt(0).toUpperCase() : 'W'}
        </div>
        {isOpen && (
          <>
            <span className="flex-1 text-left truncate tracking-wide">{team.name}</span>
            {projects.length > 0 && !isExpanded && <span className="text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">{projects.length}</span>}
          </>
        )}
      </div>
      {isExpanded && isOpen && (
        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-white/5">
          {projects.length === 0
            ? <p className="pl-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 italic font-light">Sin proyectos</p>
            : projects.map((project) => <IrisProjectRow key={project.project_id} props={props} project={project} />)}
        </div>
      )}
    </div>
  );
}
