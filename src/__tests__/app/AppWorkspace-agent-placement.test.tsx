import type { ComponentProps, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppWorkspace } from '../../app/AppWorkspace';

vi.mock('../../components/meetings/MeetingOpsPanel', () => ({ MeetingOpsPanel: () => null }));
vi.mock('../../components/ProductivityDashboard', () => ({ ProductivityDashboard: () => null }));
vi.mock('../../components/presentation/PresentationWorkspacePanel', () => ({ PresentationWorkspacePanel: () => null }));
vi.mock('../../components/artifacts/ArtifactViewerPanel', () => ({ ArtifactViewerPanel: () => null }));
vi.mock('../../components/artifacts/artifact-viewer-context', () => ({ useArtifactViewer: () => null }));
vi.mock('../../contexts/presentation-workspace-context', () => ({ usePresentationWorkspaceContext: () => ({ visible: false }) }));
vi.mock('../../components/project-workspace/FolderProjectPanel', () => ({ FolderProjectPanel: () => null }));
vi.mock('../../components/project-hub/UnifiedProjectHub', () => ({ UnifiedProjectHub: () => null }));
vi.mock('../../components/floating-chat/FloatingArtifactPreview', () => ({ FloatingArtifactPreview: () => null }));
vi.mock('../../components/floating-chat/FloatingSofliaChat', () => ({ FloatingSofliaChat: () => <button>Agente flotante del proyecto</button> }));
vi.mock('../../components/browser/BrowserWorkspaceLayout', () => ({
  BrowserWorkspaceLayout: ({ chat }: { chat: ReactNode }) => <section aria-label="Navegador lateral">{chat}</section>,
}));
vi.mock('../../app/AppChatView', () => ({
  AppChatView: ({ floating, compact, readVisibleContext }: { floating?: boolean; compact?: boolean; readVisibleContext?: unknown }) => (
    <div data-testid="chat" data-floating={String(floating)} data-compact={String(compact)} data-context={String(!!readVisibleContext)} />
  ),
}));

type Props = ComponentProps<typeof AppWorkspace>;
function workspace(overrides: Partial<Props> = {}) {
  const props = {
    activeView: 'chat', userId: 'usuario', orgId: 'organizacion',
    chat: { conversations: [], currentConversationId: null }, folder: {},
    currentConversation: null, externalPrompt: null, externalSelection: null,
    liaDegraded: false, shareLinkNotice: null, userSettings: null, ...overrides,
  } as Props;
  return render(<AppWorkspace {...props} />);
}

describe('Ubicación del agente por superficie', () => {
  it('el navegador recibe un chat compacto lateral con contexto, sin compositor flotante', () => {
    workspace({ browserWorkspaceOpen: true });
    expect(screen.getByRole('region', { name: 'Navegador lateral' })).toBeVisible();
    expect(screen.getByTestId('chat')).toHaveAttribute('data-floating', 'false');
    expect(screen.getByTestId('chat')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByTestId('chat')).toHaveAttribute('data-context', 'true');
    expect(screen.queryByRole('button', { name: 'Agente flotante del proyecto' })).not.toBeInTheDocument();
  });

  it.each(['meetings', 'productivity'] as const)('la sección %s no monta el agente de proyectos', (activeView) => {
    workspace({ activeView });
    expect(screen.queryByRole('button', { name: 'Agente flotante del proyecto' })).not.toBeInTheDocument();
  });

  it('conserva el compositor flotante en el proyecto y lo retira al abrir su navegador', () => {
    const projectWorkspace = { navigation: { section: 'tasks', canCreateChat: true }, canShowChat: true } as Props['projectWorkspace'];
    const view = workspace({ activeView: 'project-hub', projectWorkspace });
    expect(screen.getByRole('button', { name: 'Agente flotante del proyecto' })).toBeVisible();
    view.unmount();
    workspace({ activeView: 'project-hub', projectWorkspace, browserWorkspaceOpen: true });
    expect(screen.queryByRole('button', { name: 'Agente flotante del proyecto' })).not.toBeInTheDocument();
    expect(screen.getByTestId('chat')).toHaveAttribute('data-floating', 'false');
  });
});
