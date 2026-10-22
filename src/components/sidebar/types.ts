import type { MouseEvent } from 'react';
import type { Conversation } from '../../services/chat-service';
import type { Folder } from '../../services/folder-service';
import type { SofiaOrganization } from '../../lib/sofia-client';
import type { ThemeMode } from '../../hooks/useTheme';

export interface SidebarProps {
  isOpen: boolean;
  position?: 'left' | 'right' | 'bottom';
  onToggle: () => void;
  activeView: string;
  browserOpen?: boolean;
  conversations: Conversation[];
  currentConversationId: string | null;
  loadingConversations: boolean;
  conversationsUnavailableMessage?: string | null;
  onRetryConversations?: () => Promise<boolean>;
  onNewChat: () => void;
  /** Abre el panel de Reuniones (runs, transcripciones y minutas). */
  onOpenMeetings?: () => void;
  /** Abre el navegador persistente compartido con el agente. */
  onOpenBrowser?: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e: MouseEvent) => void;
  onTogglePinConversation: (id: string, isPinned: boolean) => void;
  renamingChatId: string | null;
  onSetRenamingChatId: (id: string | null) => void;
  editingChatTitle: string;
  onSetEditingChatTitle: (title: string) => void;
  onRenameChat: () => void;
  activeMenuChatId: string | null;
  onSetActiveMenuChatId: (id: string | null) => void;
  onSetMovingChatId: (id: string | null) => void;
  folders: Folder[];
  expandedFolders: Set<string>;
  currentFolderId: string | null;
  onCreateFolderClick: () => void;
  onToggleFolder: (id: string) => void;
  onOpenProject: (id: string) => void;
  onDeleteFolder: (id: string, e: MouseEvent) => void;
  /** Edicion inline del nombre de carpeta (mismo patron que los chats). */
  renamingFolderId: string | null;
  editingFolderName: string;
  onSetEditingFolderName: (name: string) => void;
  onStartRenameFolder: (id: string) => void;
  onFinishRenameFolder: () => void;
  onCancelRenameFolder: () => void;
  displayName: string;
  initials: string;
  userEmail: string | undefined;
  avatarUrl: string | undefined;
  orgName?: string | undefined;
  orgLogoUrl: string | undefined;
  organizations?: SofiaOrganization[];
  currentOrgId?: string;
  onSelectOrganization?: (orgId: string) => void;
  /** Motivo por el que no hay lista de organizaciones que mostrar. */
  organizationsUnavailableMessage?: string | null;
  /** Ausente cuando reintentar no puede recuperar nada (sesion caducada). */
  onRetryOrganizations?: () => Promise<boolean>;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}
