/**
 * Sidebar — Barra lateral principal de SofLIA Hub.
 * Extraído de App.tsx para reducir su tamaño.
 */
import { useState } from 'react';
import type { Conversation } from '../services/chat-service';
import type { Folder } from '../services/folder-service';
import type { IrisTeam, IrisProject, IrisIssue } from '../lib/iris-client';
import type { ThemeMode } from '../hooks/useTheme';
import { PROJECT_STATUS_COLORS, ISSUE_STATUS_TYPE_COLORS } from '../services/iris-data';

// ─── Types ────────────────────────────────────────────────────────────

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeView: string;

  // Chat
  conversations: Conversation[];
  currentConversationId: string | null;
  loadingConversations: boolean;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  renamingChatId: string | null;
  onSetRenamingChatId: (id: string | null) => void;
  editingChatTitle: string;
  onSetEditingChatTitle: (title: string) => void;
  onRenameChat: () => void;
  activeMenuChatId: string | null;
  onSetActiveMenuChatId: (id: string | null) => void;
  onSetMovingChatId: (id: string | null) => void;

  // Folders
  folders: Folder[];
  expandedFolders: Set<string>;
  currentFolderId: string | null;
  onCreateFolderClick: () => void;
  onToggleFolder: (id: string) => void;
  onOpenProject: (id: string) => void;
  onDeleteFolder: (id: string, e: React.MouseEvent) => void;

  // IRIS
  irisTeams: IrisTeam[];
  irisProjects: IrisProject[];
  irisIssues: Record<string, IrisIssue[]>;
  expandedTeams: Set<string>;
  expandedProjects: Set<string>;
  onToggleTeam: (id: string) => void;
  onToggleProject: (id: string) => void;
  onIrisProjectClick: (project: IrisProject) => void;
  onIrisIssueClick: (issue: IrisIssue) => void;
  onRefreshIris: () => void;

  // User & Settings
  displayName: string;
  initials: string;
  userEmail: string | undefined;
  avatarUrl: string | undefined;
  orgLogoUrl: string | undefined;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

// ─── Icons (inline SVG helpers) ───────────────────────────────────────

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-3 w-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ─── Chat Context Menu ────────────────────────────────────────────────

function ChatContextMenu({
  onRename,
  onMove,
  onDelete,
  onClose,
}: {
  onRename: () => void;
  onMove: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 mt-2 w-40 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5">
      <button
        onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-3 transition-colors group/item"
      >
        <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover/item:text-accent group-hover/item:bg-accent/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <span>Renombrar</span>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onMove(); onClose(); }}
        className="w-full text-left px-3 py-2 text-[12.5px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-3 transition-colors group/item"
      >
        <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover/item:text-accent group-hover/item:bg-accent/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
        <span>Mover</span>
      </button>

      <div className="h-px bg-gray-100 dark:bg-white/5 my-1.5 mx-2" />

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(e); onClose(); }}
        className="w-full text-left px-3 py-2 text-[12.5px] text-danger hover:bg-danger/10 flex items-center gap-3 transition-colors group/item"
      >
        <div className="w-6 h-6 rounded-md bg-danger/5 flex items-center justify-center text-danger/70 group-hover/item:text-danger group-hover/item:bg-danger/20 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <span className="font-medium">Eliminar</span>
      </button>
    </div>
  );
}

// ─── Chat Item (reusable for folder and ungrouped) ────────────────────

function ChatItem({
  conv,
  isActive,
  isRenaming,
  editingTitle,
  isMenuOpen,
  compact,
  sidebarOpen,
  onSelect,
  onStartRename,
  onEditTitle,
  onFinishRename,
  onCancelRename,
  onToggleMenu,
  onMove,
  onDelete,
}: {
  conv: Conversation;
  isActive: boolean;
  isRenaming: boolean;
  editingTitle: string;
  isMenuOpen: boolean;
  compact?: boolean;
  sidebarOpen: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onEditTitle: (val: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onToggleMenu: () => void;
  onMove: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const baseClass = compact
    ? `w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12.5px] transition-all duration-200 group/chat`
    : `w-full flex items-center ${sidebarOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-2 rounded-lg text-[13px] transition-all duration-200 group`;

  const activeClass = isActive
    ? "bg-accent/10 dark:bg-accent/15 text-accent font-medium shadow-sm"
    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200";

  // Compact uses a dot indicator, full uses a box icon
  const indicator = compact ? (
    <div className={`flex items-center justify-center w-2 h-2 shrink-0 rounded-full transition-all duration-200 ${isActive ? 'bg-accent shadow-[0_0_6px_var(--tw-colors-accent)]' : 'bg-gray-300 dark:bg-white/[0.15] group-hover/chat:bg-gray-400 dark:group-hover/chat:bg-white/30'}`} />
  ) : (
    <div className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-[8px] border transition-all duration-200 ${isActive ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white dark:bg-white/[0.02] border-gray-200/50 dark:border-white/[0.08] text-gray-400 group-hover:text-accent group-hover:border-accent/20'}`}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    </div>
  );

  return (
    <button onClick={onSelect} className={`${baseClass} ${activeClass}`} title={conv.title}>
      {indicator}
      {sidebarOpen && (
        <>
          {isRenaming ? (
            <input
              autoFocus
              type="text"
              className={`flex-1 min-w-0 bg-white dark:bg-[#1E1E1E] border border-accent rounded px-2 py-0.5 text-[${compact ? '12' : '13'}px] text-gray-900 dark:text-white outline-none`}
              value={editingTitle}
              onChange={(e) => onEditTitle(e.target.value)}
              onBlur={onFinishRename}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') onFinishRename();
                else if (e.key === 'Escape') onCancelRename();
              }}
            />
          ) : (
            <span className={`flex-1 text-left truncate${compact ? '' : ' text-[13px]'}`}>{conv.title}</span>
          )}
          <div className={`flex items-center gap-0.5 opacity-0 ${compact ? 'group-hover/chat:opacity-100' : 'group-hover:opacity-100'} transition-opacity`}>
            <button
              onClick={(e) => { e.stopPropagation(); onStartRename(); }}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              title="Renombrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>

            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors ${isMenuOpen ? 'text-accent' : 'text-gray-400 dark:text-gray-500'}`}
                title="Más opciones"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </button>

              {isMenuOpen && (
                <ChatContextMenu
                  onRename={onStartRename}
                  onMove={onMove}
                  onDelete={onDelete}
                  onClose={onToggleMenu}
                />
              )}
            </div>
          </div>
        </>
      )}
    </button>
  );
}

// ─── IRIS Tree Section ────────────────────────────────────────────────

function IrisSection({ props }: { props: SidebarProps }) {
  const {
    isOpen, irisTeams, irisProjects, irisIssues,
    expandedTeams, expandedProjects,
    onToggleTeam, onToggleProject,
    onIrisProjectClick, onIrisIssueClick, onRefreshIris,
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

      {irisTeams.map((team) => {
        const isTeamExpanded = expandedTeams.has(team.team_id);
        const teamProjects = irisProjects.filter((p) => p.team_id === team.team_id);

        return (
          <div key={team.team_id} className="mb-0.5">
            <div
              className={`w-full flex items-center ${isOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-1.5 rounded-md text-[13px] transition-all duration-200 cursor-pointer group ${isTeamExpanded ? "bg-gray-100/50 dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 font-medium" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/30 dark:hover:bg-white/[0.02] hover:text-gray-900 dark:hover:text-gray-200"}`}
              onClick={() => onToggleTeam(team.team_id)}
              title={team.name}
            >
              {isOpen && (
                <ChevronIcon className={`h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 ${isTeamExpanded ? "rotate-90 opacity-100" : ""}`} />
              )}
              <div
                className="flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-[4px] text-[10px] font-bold text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                style={{ backgroundColor: team.color || "#3b82f6" }}
              >
                {team.name ? team.name.charAt(0).toUpperCase() : "W"}
              </div>
              {isOpen && (
                <>
                  <span className="flex-1 text-left truncate tracking-wide">{team.name}</span>
                  {teamProjects.length > 0 && !isTeamExpanded && (
                    <span className="text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                      {teamProjects.length}
                    </span>
                  )}
                </>
              )}
            </div>

            {isTeamExpanded && isOpen && (
              <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 dark:border-white/5">
                {teamProjects.length === 0 ? (
                  <p className="pl-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-500 italic font-light">Sin proyectos</p>
                ) : (
                  teamProjects.map((project) => (
                    <IrisProjectRow
                      key={project.project_id}
                      project={project}
                      issues={irisIssues[project.project_id] || []}
                      isExpanded={expandedProjects.has(project.project_id)}
                      onToggle={() => onToggleProject(project.project_id)}
                      onProjectClick={() => onIrisProjectClick(project)}
                      onIssueClick={onIrisIssueClick}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Projects without team */}
      {(() => {
        const orphans = irisProjects.filter(
          (p) => !p.team_id || !irisTeams.some((t) => t.team_id === p.team_id),
        );
        if (orphans.length === 0) return null;

        return (
          <div className="mt-2 pl-1">
            {isOpen && (
              <div className="px-3 py-1 mb-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
                  WorkSpaces Globales
                </span>
              </div>
            )}
            {orphans.map((project) => (
              <div key={project.project_id} className="mb-0.5">
                <div
                  className={`w-full flex items-center ${isOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-1.5 rounded-md text-[13px] transition-all duration-200 cursor-pointer group/proj ${expandedProjects.has(project.project_id) ? "bg-gray-100/50 dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 font-medium" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100/30 dark:hover:bg-white/[0.02] hover:text-gray-900 dark:hover:text-gray-200"}`}
                  onClick={() => onToggleProject(project.project_id)}
                  onDoubleClick={() => onIrisProjectClick(project)}
                  title={`${project.project_name} — ${project.project_status}`}
                >
                  {isOpen && (
                    <ChevronIcon className={`h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover/proj:opacity-100 transition-all duration-200 ${expandedProjects.has(project.project_id) ? "rotate-90 opacity-100" : ""}`} />
                  )}
                  <div className="flex items-center justify-center w-[18px] h-[18px] shrink-0 rounded-[4px] border border-gray-200/50 dark:border-white/10 bg-white dark:bg-white/5 shadow-none">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROJECT_STATUS_COLORS[project.project_status] || "#6b7280" }} />
                  </div>
                  {isOpen && (
                    <>
                      <span className="flex-1 text-left truncate tracking-wide">{project.project_name}</span>
                      <span className="text-[10px] text-gray-400 px-1 py-0.5 opacity-0 group-hover/proj:opacity-100 transition-opacity">
                        {project.completion_percentage}%
                      </span>
                    </>
                  )}
                </div>

                {expandedProjects.has(project.project_id) && isOpen && (
                  <div className="ml-5 mt-0.5 border-l border-gray-100 dark:border-white/5 space-y-0.5">
                    {(irisIssues[project.project_id] || []).length === 0 ? (
                      <p className="pl-3 py-1.5 text-[10.5px] text-gray-400 dark:text-gray-500 italic font-light">Sin tareas</p>
                    ) : (
                      (irisIssues[project.project_id] || []).map((issue) => (
                        <IrisIssueButton key={issue.issue_id} issue={issue} onClick={() => onIrisIssueClick(issue)} />
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </>
  );
}

// ─── IRIS Project Row ─────────────────────────────────────────────────

function IrisProjectRow({
  project, issues, isExpanded, onToggle, onProjectClick, onIssueClick,
}: {
  project: IrisProject;
  issues: IrisIssue[];
  isExpanded: boolean;
  onToggle: () => void;
  onProjectClick: () => void;
  onIssueClick: (issue: IrisIssue) => void;
}) {
  const statusColor = PROJECT_STATUS_COLORS[project.project_status] || "#6b7280";

  return (
    <div className="relative mt-0.5">
      <div
        className={`w-full flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-r-md text-[12.5px] transition-all duration-200 cursor-pointer group/proj ${isExpanded ? "text-gray-900 dark:text-white font-medium bg-gray-50 dark:bg-white/[0.02]" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.01]"}`}
        onClick={onToggle}
        onDoubleClick={onProjectClick}
        title={`${project.project_name} — ${project.project_status} (${project.completion_percentage}%)`}
      >
        <div className="absolute left-0 top-[14px] w-2.5 h-px bg-gray-100 dark:bg-white/5 group-hover/proj:bg-gray-300 dark:group-hover/proj:bg-white/20 transition-colors" />
        <div className="w-1.5 h-1.5 rounded-full z-10 shrink-0" style={{ backgroundColor: statusColor }} />
        <span className="flex-1 text-left truncate tracking-wide">{project.project_name}</span>
        <span className="text-[9px] px-1 py-0.5 rounded border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-0 group-hover/proj:opacity-100 transition-all font-medium">
          {project.completion_percentage}%
        </span>
      </div>

      {isExpanded && (
        <div className="ml-4 mt-0.5 pb-1 space-y-0.5 border-l border-gray-100 dark:border-white/5">
          {issues.length === 0 ? (
            <p className="pl-3 py-1 text-[10.5px] text-gray-400 dark:text-gray-500 italic">Sin tareas</p>
          ) : (
            issues.map((issue) => (
              <IrisIssueButton key={issue.issue_id} issue={issue} onClick={() => onIssueClick(issue)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── IRIS Issue Button ────────────────────────────────────────────────

function IrisIssueButton({ issue, onClick }: { issue: IrisIssue; onClick: () => void }) {
  const color = ISSUE_STATUS_TYPE_COLORS[issue.status?.status_type || "backlog"] || "#6b7280";
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

// ─── User Menu ────────────────────────────────────────────────────────

function UserMenu({
  isOpen: sidebarOpen,
  displayName,
  initials,
  userEmail,
  avatarUrl,
  orgLogoUrl,
  theme,
  onSetTheme,
  onOpenSettings,
  onSignOut,
}: Pick<SidebarProps, 'isOpen' | 'displayName' | 'initials' | 'userEmail' | 'avatarUrl' | 'orgLogoUrl' | 'theme' | 'onSetTheme' | 'onOpenSettings' | 'onSignOut'>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isThemeSubMenuOpen, setIsThemeSubMenuOpen] = useState(false);

  return (
    <div className="h-[73px] px-2 border-t border-gray-200 dark:border-white/10 relative flex-shrink-0 flex items-center box-border bg-gray-50 dark:bg-transparent">
      <div className={`w-full flex items-center ${sidebarOpen ? "gap-3 px-2" : "justify-center px-0"} text-sm text-gray-700 dark:text-gray-300`}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`flex items-center gap-3 w-full text-left hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg p-1.5 transition-colors ${!sidebarOpen && "justify-center"}`}
        >
          {orgLogoUrl ? (
            <img src={orgLogoUrl} alt="Org Logo" className="w-8 h-8 object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 overflow-hidden" title={displayName}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
          )}
          {sidebarOpen && (
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <div className="font-medium text-gray-900 dark:text-white truncate">{displayName}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 dark:text-gray-500 transition-transform ${isMenuOpen ? "rotate-180" : ""}`}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          )}
        </button>

        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
            <div
              className={`absolute bottom-full translate-y-[-8px] bg-white dark:bg-[#1E1E1E] backdrop-blur-xl border border-gray-200/50 dark:border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] py-1.5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 ring-1 ring-black/5 ${
                sidebarOpen ? "left-1.5 w-[calc(100%-12px)]" : "left-2 w-[240px]"
              } ${isThemeSubMenuOpen ? '' : 'overflow-hidden'}`}
            >
              {/* User info on collapsed sidebar */}
              <div className={`px-4 py-3 mb-1.5 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] ${sidebarOpen ? 'hidden' : 'block'}`}>
                <div className="font-bold text-gray-900 dark:text-gray-100 truncate text-[13px]">{displayName}</div>
                <div className="text-[10.5px] text-gray-500 truncate dark:text-gray-400 font-medium">{userEmail}</div>
              </div>

              <div className="px-1.5 space-y-0.5">
                {/* Settings */}
                <button
                  onClick={() => { onOpenSettings(); setIsMenuOpen(false); }}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-gray-700 dark:text-gray-300 hover:text-accent dark:hover:text-accent hover:bg-accent/5 transition-all group/item"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center group-hover/item:bg-accent/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500 group-hover/item:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  Configuración
                </button>

                {/* Theme */}
                <div className="px-3 py-1 mt-0.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <div className="text-[13px] font-medium text-gray-700 dark:text-gray-300 ml-0.5">Apariencia</div>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsThemeSubMenuOpen(!isThemeSubMenuOpen); }}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                        isThemeSubMenuOpen
                          ? 'bg-accent/10 text-accent'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-accent/5 hover:text-accent border border-gray-200 dark:border-white/5'
                      }`}
                    >
                      {theme === 'light' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      ) : theme === 'dark' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      )}
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className={`ml-1 opacity-60 transition-transform ${isThemeSubMenuOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>

                    {isThemeSubMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-3 p-1 bg-white dark:bg-[#252525] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex gap-1 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-150 ring-1 ring-black/5">
                        {([
                          { id: 'light' as const, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
                          { id: 'system' as const, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
                          { id: 'dark' as const, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
                        ]).map((opt) => (
                          <button
                            key={opt.id}
                            onClick={(e) => { e.stopPropagation(); onSetTheme(opt.id); setIsThemeSubMenuOpen(false); }}
                            className={`w-8.5 h-8.5 flex items-center justify-center rounded-xl transition-all ${
                              theme === opt.id
                                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                          >
                            {opt.icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2" />

                {/* Log out */}
                <button
                  onClick={onSignOut}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-danger hover:bg-danger/5 transition-all group/logout"
                >
                  <div className="w-8 h-8 rounded-lg bg-danger/5 flex items-center justify-center group-hover/logout:bg-danger/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-danger opacity-70 group-hover/logout:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Sidebar Component ───────────────────────────────────────────

export function Sidebar(props: SidebarProps) {
  const {
    isOpen, onToggle, activeView,
    conversations, currentConversationId, loadingConversations,
    onNewChat, onSelectConversation, onDeleteConversation,
    renamingChatId, onSetRenamingChatId, editingChatTitle, onSetEditingChatTitle, onRenameChat,
    activeMenuChatId, onSetActiveMenuChatId, onSetMovingChatId,
    folders, expandedFolders, currentFolderId,
    onCreateFolderClick, onToggleFolder, onOpenProject, onDeleteFolder,
  } = props;

  const folderChats = (folderId: string) => conversations.filter((c) => c.folder_id === folderId);
  const ungroupedChats = conversations.filter((c) => !c.folder_id);

  const chatItemProps = (conv: Conversation, compact?: boolean) => ({
    conv,
    isActive: currentConversationId === conv.id && activeView === 'chat',
    isRenaming: renamingChatId === conv.id,
    editingTitle: editingChatTitle,
    isMenuOpen: activeMenuChatId === conv.id,
    compact,
    sidebarOpen: isOpen,
    onSelect: () => onSelectConversation(conv.id),
    onStartRename: () => { onSetRenamingChatId(conv.id); onSetEditingChatTitle(conv.title); },
    onEditTitle: onSetEditingChatTitle,
    onFinishRename: onRenameChat,
    onCancelRename: () => onSetRenamingChatId(null),
    onToggleMenu: () => onSetActiveMenuChatId(activeMenuChatId === conv.id ? null : conv.id),
    onMove: () => onSetMovingChatId(conv.id),
    onDelete: (e: React.MouseEvent) => onDeleteConversation(conv.id, e),
  });

  return (
    <aside
      className={`${
        isOpen ? "w-60" : "w-14"
      } flex-shrink-0 flex flex-col h-full bg-gray-50 dark:bg-[#202123] text-gray-700 dark:text-white border-r border-gray-200 dark:border-none transition-all duration-300 ease-in-out z-30`}
    >
      {/* Brand */}
      <div className={`px-4 pt-4 pb-2 flex items-center ${isOpen ? "justify-between" : "justify-center"} min-h-[50px]`}>
        {isOpen && (
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <img src="./assets/Icono.png" alt="SofLIA" className="w-7 h-7 object-contain dark:filter-none filter-accent-themed" />
          </div>
        )}
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
          title={isOpen ? "Colapsar menú" : "Expandir menú"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v18" />
          </svg>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="px-2 py-2 space-y-1">
        <button
          onClick={onNewChat}
          className={`w-full flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 rounded-lg border border-gray-200 dark:border-white/20 bg-white dark:bg-transparent hover:bg-gray-100 dark:hover:bg-[#2A2B32] transition-colors text-sm shadow-sm dark:shadow-none`}
          title="Nuevo Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {isOpen && <span>Nuevo Chat</span>}
        </button>

        <button
          onClick={onCreateFolderClick}
          className={`w-full flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2A2B32] hover:text-gray-900 dark:hover:text-white transition-colors text-sm`}
          title="Nueva Carpeta"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          {isOpen && <span>Nueva Carpeta</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto no-scrollbar">
        {/* IRIS */}
        <IrisSection props={props} />

        {/* Folders */}
        {folders.length > 0 && (
          <>
            {isOpen && (
              <div className="pt-5 pb-2 px-3">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">Carpetas</span>
              </div>
            )}

            {folders.map((folder) => {
              const chatsInFolder = folderChats(folder.id);
              const isExpanded = expandedFolders.has(folder.id);
              const isActive = activeView === 'project' && currentFolderId === folder.id;

              return (
                <div key={folder.id}>
                  <div
                    className={`w-full flex items-center ${isOpen ? "gap-2.5 px-3" : "justify-center px-0"} py-2 rounded-lg text-[13px] transition-all duration-200 cursor-pointer group ${
                      isActive
                        ? "bg-accent/10 dark:bg-accent/20 text-accent font-semibold shadow-sm"
                        : isExpanded
                        ? "bg-gray-100/50 dark:bg-white/[0.04] text-gray-800 dark:text-gray-200 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                    onClick={() => onToggleFolder(folder.id)}
                    onDoubleClick={() => onOpenProject(folder.id)}
                    title={folder.name}
                  >
                    {isOpen && (
                      <ChevronIcon className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 opacity-60 group-hover:opacity-100 ${isActive ? "text-accent opacity-100" : ""} ${isExpanded ? "rotate-90" : ""}`} />
                    )}
                    <div className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-[8px] border transition-all duration-200 ${isActive ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white dark:bg-white/[0.02] border-gray-200/50 dark:border-white/[0.08] text-gray-400 group-hover:text-accent group-hover:border-accent/20'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    {isOpen && (
                      <>
                        <span className="flex-1 text-left truncate">{folder.name}</span>
                        {chatsInFolder.length > 0 && (
                          <span className="text-[10px] bg-gray-200/50 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded-full text-gray-500 dark:text-gray-400">
                            {chatsInFolder.length}
                          </span>
                        )}
                        <button
                          onClick={(e) => onDeleteFolder(folder.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-white/10 transition-all"
                          title="Eliminar carpeta"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>

                  {isExpanded && isOpen && (
                    <div className="ml-4 space-y-0.5">
                      {chatsInFolder.length === 0 ? (
                        <p className="px-3 py-1.5 text-[11px] text-gray-400 dark:text-gray-600 italic">Vacia</p>
                      ) : (
                        chatsInFolder.map((conv) => (
                          <ChatItem key={conv.id} {...chatItemProps(conv, true)} />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Ungrouped Conversations */}
        {isOpen && (
          <div className="pt-5 pb-2 px-3">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] font-semibold">
              {folders.length > 0 ? "Sin carpeta" : "Conversaciones"}
            </span>
          </div>
        )}

        {loadingConversations ? (
          isOpen ? (
            <div className="px-3 py-4 text-center">
              <div className="flex gap-1 justify-center">
                <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          ) : null
        ) : ungroupedChats.length === 0 ? (
          isOpen ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">Sin conversaciones aun</p>
            </div>
          ) : null
        ) : (
          ungroupedChats.map((conv) => (
            <ChatItem key={conv.id} {...chatItemProps(conv)} />
          ))
        )}
      </nav>

      {/* Footer */}
      <UserMenu
        isOpen={isOpen}
        displayName={props.displayName}
        initials={props.initials}
        userEmail={props.userEmail}
        avatarUrl={props.avatarUrl}
        orgLogoUrl={props.orgLogoUrl}
        theme={props.theme}
        onSetTheme={props.onSetTheme}
        onOpenSettings={props.onOpenSettings}
        onSignOut={props.onSignOut}
      />
    </aside>
  );
}
