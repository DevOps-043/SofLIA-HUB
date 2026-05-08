import type { SidebarProps } from './types';
import { IrisTeamRow } from './IrisTeamRow';
import { IrisOrphanProjects } from './IrisOrphanProjects';

export function IrisSection({ props }: { props: SidebarProps }) {
  const {
    isOpen,
    irisTeams,
    irisProjects,
    expandedTeams,
    onRefreshIris,
  } = props;

  if (irisTeams.length === 0 && irisProjects.length === 0) return null;

  return (
    <>
      {isOpen && (
        <div className="pt-4 pb-2 px-3 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
            WorkSpaces
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onRefreshIris(); }}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-accent transition-all"
            title="Actualizar workspaces"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      )}

      {irisTeams.map((team) => (
        <IrisTeamRow
          key={team.team_id}
          props={props}
          team={team}
          projects={irisProjects.filter((project) => project.team_id === team.team_id)}
          isExpanded={expandedTeams.has(team.team_id)}
        />
      ))}

      <IrisOrphanProjects props={props} />
    </>
  );
}
