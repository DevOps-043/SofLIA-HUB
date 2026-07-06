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
        className={`min-h-9 w-full flex items-center ${isOpen ? 'gap-2 px-2' : 'justify-center px-0'} rounded-2xl text-[13px] transition-all duration-200 cursor-pointer group ${isExpanded ? 'bg-gray-100/80 text-[#0A2540] font-semibold dark:bg-white/[0.05] dark:text-white' : 'text-secondary dark:text-white/50 hover:bg-[#0A2540]/5 hover:text-[#0A2540] dark:hover:bg-white/[0.05] dark:hover:text-white/80'}`}
        onClick={() => props.onToggleTeam(team.team_id)}
        title={team.name}
      >
        {isOpen && <ChevronIcon className={`h-3 w-3 shrink-0 text-secondary/70 opacity-50 transition-all duration-200 group-hover:opacity-100 dark:text-white/40 ${isExpanded ? 'rotate-90 opacity-100' : ''}`} />}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl text-[10px] font-bold text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10" style={{ backgroundColor: team.color || '#3b82f6' }}>
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
        <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-200/60 pl-2 dark:border-white/[0.06]">
          {projects.length === 0
            ? <p className="px-2 py-1.5 text-[11px] italic text-secondary/70 dark:text-white/30">Sin proyectos</p>
            : projects.map((project) => <IrisProjectRow key={project.project_id} props={props} project={project} />)}
        </div>
      )}
    </div>
  );
}
