/**
 * Tests UI-003 to UI-014: Sidebar.tsx — Sidebar navigation component tests.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock iris-data to prevent Supabase import chain
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

import { Sidebar, type SidebarProps } from '../../components/Sidebar';

function createDefaultProps(overrides?: Partial<SidebarProps>): SidebarProps {
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
    orgLogoUrl: undefined,
    theme: 'dark' as const,
    onSetTheme: vi.fn(),
    onOpenSettings: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  };
}

describe('Sidebar component', () => {
  // UI-003: Renders navigation structure
  it('UI-003: renders sidebar with user info when open', () => {
    const props = createDefaultProps();
    render(<Sidebar {...props} />);

    // Should display user initials or name
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  // UI-004: Displays conversations list
  it('UI-004: renders conversation entries when provided', () => {
    const props = createDefaultProps({
      conversations: [
        { id: 'c1', user_id: 'u1', title: 'Chat con SofLIA', created_at: '2026-01-01', updated_at: '2026-01-01' },
        { id: 'c2', user_id: 'u1', title: 'Proyecto React', created_at: '2026-01-02', updated_at: '2026-01-02' },
      ],
    });
    render(<Sidebar {...props} />);

    expect(screen.getByText('Chat con SofLIA')).toBeInTheDocument();
    expect(screen.getByText('Proyecto React')).toBeInTheDocument();
  });

  // UI-014: Clicking a conversation calls onSelectConversation
  it('UI-014: clicking a conversation triggers onSelectConversation', () => {
    const onSelectConversation = vi.fn();
    const props = createDefaultProps({
      conversations: [
        { id: 'c1', user_id: 'u1', title: 'Mi Chat', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ],
      onSelectConversation,
    });
    render(<Sidebar {...props} />);

    const chatItem = screen.getByText('Mi Chat');
    fireEvent.click(chatItem);

    expect(onSelectConversation).toHaveBeenCalledWith('c1');
  });
});
