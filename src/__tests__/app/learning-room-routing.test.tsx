import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningLiveSessionReference } from '../../shared/learning-live-session';
import { AppContent } from '../../app/AppContent';

const reference = { organization_slug: 'acme', session_id: '00000000-0000-4000-8000-000000000031' };
const mocks = vi.hoisted(() => ({
  request: (() => {}) as (value: LearningLiveSessionReference) => void,
  browserOpen: () => {},
  scopedMessages: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'learner' }, dataUserId: 'learner', loading: false, sofiaContext: { currentOrganization: { id: 'org', slug: 'acme' }, teams: [] } }) }));
vi.mock('../../hooks/useChatManager', () => ({ useChatManager: () => ({ getScopedMessagesHandler: () => mocks.scopedMessages }) }));
vi.mock('../../hooks/useFolderManager', () => ({ useFolderManager: () => ({}) }));
vi.mock('../../hooks/useIrisData', () => ({ useIrisData: () => ({}) }));
vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }) }));
vi.mock('../../app/useAppBootstrap', () => ({ useAppBootstrap: vi.fn() }));
vi.mock('../../app/useAppDerivedData', () => ({ useAppDerivedData: () => ({}) }));
vi.mock('../../app/useAppIpcTriggers', () => ({ useAppIpcTriggers: () => ({}) }));
vi.mock('../../app/useAppViewHandlers', () => ({ useAppViewHandlers: () => ({}) }));
vi.mock('../../app/useAutoDismissNotice', () => ({ useAutoDismissNotice: vi.fn() }));
vi.mock('../../app/useCloseActiveChatMenu', () => ({ useCloseActiveChatMenu: vi.fn() }));
vi.mock('../../app/useLegacyUserMigration', () => ({ useLegacyUserMigration: vi.fn() }));
vi.mock('../../app/useMeetingTriggerNotice', () => ({ useMeetingTriggerNotice: vi.fn() }));
vi.mock('../../app/useShareLinkRouting', () => ({ useShareLinkRouting: vi.fn() }));
vi.mock('../../app/useLearningLiveSession', async () => {
  const { useState } = await import('react');
  return { useLearningLiveSession: ({ onRequested }: { onRequested: () => void }) => {
    const [selected, setSelected] = useState<LearningLiveSessionReference | null>(null);
    mocks.request = (value) => { setSelected(value); onRequested(); };
    return { reference: selected, select: mocks.request, dismiss: () => setSelected(null) };
  } };
});
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: {
  isAvailable: () => true,
  subscribe: ({ onOpenRequested }: { onOpenRequested: () => void }) => { mocks.browserOpen = onOpenRequested; return () => {}; },
} }));
vi.mock('../../services/browser-writing', () => ({ improveBrowserSelection: vi.fn() }));
vi.mock('../../services/learning-live-service', () => ({ learningLiveService: { workspace: vi.fn().mockResolvedValue({ success: true, snapshot: { can_manage: false, session: { title: 'Clase del participante' } } }) } }));
vi.mock('../../components/Auth', () => ({ Auth: () => null }));
vi.mock('../../app/AppLoadingScreen', () => ({ AppLoadingScreen: () => null }));
vi.mock('../../app/AppModals', () => ({ AppModals: () => null }));
vi.mock('../../app/OrbWindowRoot', () => ({ OrbWindowRoot: () => null }));
vi.mock('../../components/ui/AppTitleBar', () => ({ AppTitleBar: () => <div>Controles de ventana</div> }));
vi.mock('../../app/AppSidebar', () => ({ AppSidebar: ({ onOpenBrowser }: { onOpenBrowser: () => void }) => <aside aria-label="Conversaciones"><button onClick={onOpenBrowser}>Abrir navegador</button></aside> }));
vi.mock('../../app/AppWorkspace', () => ({ AppWorkspace: ({ browserWorkspaceOpen, onOpenLiveSessions }: { browserWorkspaceOpen: boolean; onOpenLiveSessions: () => void }) => <div>{browserWorkspaceOpen && <div data-testid="browser-workspace">Navegador</div>}<div data-testid="old-chat">Conversación anterior</div><button onClick={onOpenLiveSessions}>Ver sesiones</button></div> }));
vi.mock('../../components/learning-live/LearningSessions', () => ({ LearningSessions: ({ onSelect }: { onSelect: (value: LearningLiveSessionReference) => void }) => <section aria-label="Agenda de sesiones"><button onClick={() => onSelect(reference)}>Seleccionar sesión</button></section> }));
vi.mock('../../components/agents/AgentActivityPanel', () => ({ AgentActivityPanel: () => <div data-testid="agents">Actividad de agentes</div> }));
vi.mock('../../components/agents/AgentActivityProvider', () => ({ AgentActivityProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('../../components/artifacts/ArtifactViewerProvider', () => ({ ArtifactViewerProvider: ({ children }: { children: React.ReactNode }) => children }));

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => vi.useRealTimers());
function openApp() {
  render(<AppContent />);
  act(() => { vi.advanceTimersByTime(6000); });
}
describe('el aula tiene una vista exclusiva', () => {
  it.each(['Volver a mis sesiones', 'Cerrar aula'])('sustituye el navegador y el chat al recibir una sesión, y %s regresa a la agenda', (exit) => {
    openApp();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir navegador' }));
    expect(screen.getByTestId('browser-workspace')).toBeInTheDocument();
    act(() => mocks.request(reference));
    expect(screen.getByRole('region', { name: 'Espacio de la sesión' })).toBeInTheDocument();
    expect(screen.queryByTestId('browser-workspace')).not.toBeInTheDocument();
    expect(screen.queryByTestId('old-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agents')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Conversaciones' })).not.toBeInTheDocument();
    act(() => mocks.browserOpen());
    expect(screen.queryByTestId('browser-workspace')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: exit }));
    expect(screen.getByRole('region', { name: 'Agenda de sesiones' })).toBeInTheDocument();
    expect(screen.queryByTestId('browser-workspace')).not.toBeInTheDocument();
  });
  it('abre el lienzo desde la agenda sin montar el chat anterior', () => {
    openApp();
    fireEvent.click(screen.getByRole('button', { name: 'Ver sesiones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar sesión' }));
    expect(screen.getByRole('region', { name: 'Espacio de la sesión' })).toBeInTheDocument();
    expect(screen.queryByTestId('old-chat')).not.toBeInTheDocument();
  });
});
