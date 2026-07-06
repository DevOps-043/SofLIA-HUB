import { vi } from 'vitest';

vi.mock('../../services/iris-data', () => ({
  PROJECT_STATUS_COLORS: {},
  ISSUE_STATUS_TYPE_COLORS: {},
}));

vi.mock('../../lib/iris-client', () => ({
  irisSupa: null,
  isIrisConfigured: vi.fn(() => false),
}));

vi.mock('../../lib/sofia-client', () => ({
  sofiaSupa: null,
  isSofiaConfigured: vi.fn(() => false),
}));

vi.mock('../../config', () => ({
  IRIS_SUPABASE: { URL: '', ANON_KEY: '' },
  SOFIA_SUPABASE: { URL: '', ANON_KEY: '' },
}));

export { Sidebar } from '../../components/Sidebar';
import type { SidebarProps } from '../../components/Sidebar';

export function createDefaultProps(overrides?: Partial<SidebarProps>): SidebarProps {
  return {
    isOpen: true,
    onToggle: vi.fn(),
    activeView: 'chat',
    conversations: [],
    currentConversationId: null,
    loadingConversations: false,
    onNewChat: vi.fn(),
    onSelectConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onTogglePinConversation: vi.fn(),
    renamingChatId: null,
    onSetRenamingChatId: vi.fn(),
    editingChatTitle: '',
    onSetEditingChatTitle: vi.fn(),
    onRenameChat: vi.fn(),
    activeMenuChatId: null,
    onSetActiveMenuChatId: vi.fn(),
    onSetMovingChatId: vi.fn(),
    folders: [],
    expandedFolders: new Set(),
    currentFolderId: null,
    onCreateFolderClick: vi.fn(),
    onToggleFolder: vi.fn(),
    onOpenProject: vi.fn(),
    onDeleteFolder: vi.fn(),
    irisTeams: [],
    irisProjects: [],
    irisIssues: {},
    expandedTeams: new Set(),
    expandedProjects: new Set(),
    onToggleTeam: vi.fn(),
    onToggleProject: vi.fn(),
    onIrisProjectClick: vi.fn(),
    onIrisIssueClick: vi.fn(),
    onRefreshIris: vi.fn(),
    displayName: 'Test User',
    initials: 'TU',
    userEmail: 'test@soflia.com',
    avatarUrl: undefined,
    orgName: undefined,
    orgLogoUrl: undefined,
    theme: 'dark' as const,
    onSetTheme: vi.fn(),
    onOpenSettings: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
}
