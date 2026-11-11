import type { Conversation } from "../../services/chat-service";

export type ProjectSection =
  | "summary"
  | "tasks"
  | "files"
  | "web"
  | "chats"
  | "milestones"
  | "cycles"
  | "teams"
  | "metrics"
  | "activity"
  | "chat";
export interface ProjectNavigation {
  browserProject?: ProjectBrowserTarget;
  name: string;
  section: ProjectSection;
  conversations: Conversation[];
  currentConversationId: string | null;
  canCreateChat: boolean;
  chatMessage?: string;
  onRetryChats?: () => void;
  browserOpen: boolean;
  onNavigate: (section: ProjectSection) => void;
  onBack: () => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onOpenBrowser: () => void;
  onBrowserNewChat?: () => Promise<void>;
  onBrowserOpenChat?: (id: string) => Promise<void>;
}
export interface ProjectBrowserTarget {
  organizationId: string;
  workspaceId: string;
  projectId: string;
  name: string;
  canWrite: boolean;
}
export const PROJECT_SECTIONS: Array<{
  id: Exclude<ProjectSection, "chat">;
  label: string;
}> = [
  { id: "summary", label: "Resumen" },
  { id: "tasks", label: "Tareas" },
  { id: "files", label: "Archivos" },
  { id: "web", label: "Páginas web" },
  { id: "chats", label: "Chats del proyecto" },
  { id: "milestones", label: "Hitos" },
  { id: "cycles", label: "Ciclos" },
  { id: "teams", label: "Equipos" },
  { id: "metrics", label: "Métricas" },
  { id: "activity", label: "Actividad" },
];
