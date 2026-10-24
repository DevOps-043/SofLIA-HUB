/** Fixture manual aislada: sin credenciales, servidor de negocio ni datos reales. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../../src/index.css";
import { Sidebar } from "../../../src/components/Sidebar";
import type { SidebarProps } from "../../../src/components/sidebar/types";
import { UnifiedProjectHub } from "../../../src/components/project-hub/UnifiedProjectHub";
import type {
  ProjectNavigation,
  ProjectSection,
} from "../../../src/components/project-workspace/types";

const noop = () => undefined;
const project = {
  project_id: "p",
  workspace_id: "w",
  project_key: "QA",
  project_name: "Lanzamiento Soflia",
  project_description:
    "Diseñar, construir y lanzar la nueva experiencia de Soflia.",
  project_status: "active",
  priority_level: "high",
  health_status: "on_track",
  completion_percentage: 67,
  updated_at: "2026-10-23",
  target_date: "2026-11-12",
  start_date: "2026-10-19",
  role: "owner",
  team_id: "t",
};
const ok = (data: unknown) => Promise.resolve({ success: true, data });
Object.assign(window, {
  projectHubApi: {
    getProject: () => ok(project),
    getAnalytics: () =>
      ok({
        tasks: { total: 36, completed: 24, overdue: 4 },
        recent_activity: [],
      }),
    listTasks: () =>
      ok([
        {
          issue_id: "a",
          title: "Validar flujo de importación",
          task_statuses: { name: "En curso" },
          task_priorities: { priority_level: "high" },
          assignee: { display_name: "Ana" },
        },
        {
          issue_id: "b",
          title: "Preparar pruebas de lanzamiento",
          task_statuses: { name: "Pendiente" },
        },
      ]),
    listEvidence: () =>
      ok([
        {
          evidence_id: "f",
          title: "Brief del lanzamiento.pdf",
          evidence_type: "upload",
          metadata: { upload_state: "ready" },
          created_at: "2026-10-23",
        },
        {
          evidence_id: "e",
          title: "Investigación de usuarios",
          evidence_type: "link",
          created_at: "2026-10-23",
        },
      ]),
    listMembers: () =>
      ok([
        {
          member_id: "u",
          project_role: "owner",
          user: { display_name: "Ana López" },
        },
      ]),
  },
});
const defaults: SidebarProps = {
  isOpen: true,
  onToggle: noop,
  activeView: "project-hub",
  conversations: [],
  currentConversationId: null,
  loadingConversations: false,
  onNewChat: noop,
  onSelectConversation: noop,
  onDeleteConversation: noop,
  onTogglePinConversation: noop,
  renamingChatId: null,
  onSetRenamingChatId: noop,
  editingChatTitle: "",
  onSetEditingChatTitle: noop,
  onRenameChat: noop,
  activeMenuChatId: null,
  onSetActiveMenuChatId: noop,
  onSetMovingChatId: noop,
  folders: [],
  expandedFolders: new Set(),
  currentFolderId: null,
  onCreateFolderClick: noop,
  onToggleFolder: noop,
  onOpenProject: noop,
  onDeleteFolder: noop,
  renamingFolderId: null,
  editingFolderName: "",
  onSetEditingFolderName: noop,
  onStartRenameFolder: noop,
  onFinishRenameFolder: noop,
  onCancelRenameFolder: noop,
  irisTeams: [],
  irisProjects: [],
  irisIssues: {},
  expandedTeams: new Set(),
  expandedProjects: new Set(),
  onToggleTeam: noop,
  onToggleProject: noop,
  onIrisProjectClick: noop,
  onIrisIssueClick: noop,
  onRefreshIris: noop,
  displayName: "Ana López",
  initials: "AL",
  userEmail: undefined,
  avatarUrl: undefined,
  orgName: "Organización de prueba",
  orgLogoUrl: undefined,
  theme: "light",
  onSetTheme: noop,
  onOpenSettings: noop,
  onSignOut: noop,
};
export function Preview() {
  const [section, setSection] = useState<ProjectSection>("summary");
  const [expanded, setExpanded] = useState(true);
  const navigation: ProjectNavigation = {
    name: project.project_name,
    section,
    conversations: [
      "Decisiones de producto",
      "Plan de lanzamiento",
      "Revisión de entregables",
    ].map((title, i) => ({
      id: String(i),
      user_id: "u",
      title,
      created_at: "",
      updated_at: "",
    })),
    currentConversationId: null,
    canCreateChat: true,
    browserOpen: false,
    onNavigate: setSection,
    onBack: noop,
    onNewChat: () => setSection("chats"),
    onOpenChat: () => setSection("chats"),
    onOpenBrowser: noop,
  };
  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex h-8 shrink-0 items-center justify-end px-5 text-[10px] text-secondary">
        Prueba visual · Datos de prueba
      </div>
      <div className="flex min-h-0 flex-1">
        <Sidebar
          {...defaults}
          isOpen={expanded}
          onToggle={() => setExpanded(!expanded)}
          projectNavigation={navigation}
        />
        <UnifiedProjectHub
          workspaceId="w"
          projectId="p"
          section={section}
          onNavigate={setSection}
          navigation={navigation}
        />
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
