import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContent } from '../../app/AppContent';
import type { StreamResult } from '../../services/gemini-chat';
import type { ComponentProps } from 'react';
import type { AppWorkspace } from '../../app/AppWorkspace';
import { useChatRuntime } from '../../adapters/desktop_ui/chat-ui/useChatRuntime';
import type { useChatUIState } from '../../adapters/desktop_ui/chat-ui/useChatUIState';
import { useArtifactViewer } from '../../components/artifacts/artifact-viewer-context';

const mocks = vi.hoisted(() => ({
  send: vi.fn<(...args: unknown[]) => Promise<StreamResult>>(),
  auth: { user: { id: 'usuario' }, dataUserId: 'usuario', loading: false, sofiaContext: { currentOrganization: { id: 'organizacion' }, teams: [] } },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../hooks/useFolderManager', () => ({ useFolderManager: () => ({ currentFolderId: null }) }));
vi.mock('../../hooks/useIrisData', () => ({ useIrisData: () => ({}) }));
vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));
vi.mock('../../hooks/chat-manager/useChatRefreshEffects', () => ({ useChatRefreshEffects: vi.fn() }));
vi.mock('../../services/chat/sync', () => ({ syncPendingChatState: () => new Promise(() => {}) }));
vi.mock('../../services/chat/operations/title', () => ({ PENDING_MODEL_TITLE: 'Preparando título', generateTitleWithModel: async () => 'Conversación inicial' }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: {} }, isSupabaseConfigured: () => false }));
vi.mock('../../hooks/useModelSelector', () => ({ MODEL_OPTIONS: [], useModelSelector: () => ({ preferredPrimaryModel: 'gpt-6.1-terra', thinkingMode: 'high' }) }));
vi.mock('../../services/gemini-chat', () => ({ sendMessageStream: mocks.send, getPublicAiErrorMessage: () => 'No pude completar la respuesta en este momento. Intenta de nuevo.' }));
vi.mock('../../services/image-generation', () => ({ generateImage: vi.fn() }));
vi.mock('../../services/iris-data', () => ({ needsIrisData: () => false }));
vi.mock('../../services/memory-bridge', () => ({ syncCurrentOwner: vi.fn(), fetchChatMemoryContext: async () => '', recordChatTurn: vi.fn() }));
vi.mock('../../app/useAppBootstrap', () => ({ useAppBootstrap: vi.fn() }));
vi.mock('../../app/useAppDerivedData', () => ({ useAppDerivedData: () => ({}) }));
vi.mock('../../app/useAppIpcTriggers', () => ({ useAppIpcTriggers: () => ({}) }));
vi.mock('../../app/useAppViewHandlers', () => ({ useAppViewHandlers: () => ({}) }));
vi.mock('../../app/useProjectWorkspace', () => ({ useProjectWorkspace: () => ({}) }));
vi.mock('../../app/useAutoDismissNotice', () => ({ useAutoDismissNotice: vi.fn() }));
vi.mock('../../app/useCloseActiveChatMenu', () => ({ useCloseActiveChatMenu: vi.fn() }));
vi.mock('../../app/useLegacyUserMigration', () => ({ useLegacyUserMigration: vi.fn() }));
vi.mock('../../app/useMeetingTriggerNotice', () => ({ useMeetingTriggerNotice: vi.fn() }));
vi.mock('../../app/useShareLinkRouting', () => ({ useShareLinkRouting: vi.fn() }));
vi.mock('../../app/useLearningLiveSession', () => ({ useLearningLiveSession: () => ({}) }));
vi.mock('../../services/integrated-browser-service', () => ({ integratedBrowserService: { isAvailable: () => false } }));
vi.mock('../../services/browser-writing', () => ({ improveBrowserSelection: vi.fn() }));
vi.mock('../../components/Auth', () => ({ Auth: () => null }));
vi.mock('../../app/AppLoadingScreen', () => ({ AppLoadingScreen: () => null }));
vi.mock('../../app/AppModals', () => ({ AppModals: () => null }));
vi.mock('../../components/ui/AppTitleBar', () => ({ AppTitleBar: () => null }));
vi.mock('../../app/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('../../components/agents/AgentActivityPanel', () => ({ AgentActivityPanel: () => null }));
vi.mock('../../components/agents/AgentActivityProvider', () => ({ AgentActivityProvider: ({ children }: { children: React.ReactNode }) => children }));

// Se conserva AppContent, su proveedor real, el guardado local y el controlador
// real del turno. Sólo se sustituye la presentación visual del workspace.
vi.mock('../../app/AppWorkspace', () => ({ AppWorkspace: Workspace }));
function Workspace({ chat, onMessagesChange }: ComponentProps<typeof AppWorkspace>) {
  const state = { modes: {}, input: { set: vi.fn() }, selection: { set: vi.fn() } } as unknown as ReturnType<typeof useChatUIState>;
  const { chat: processor } = useChatRuntime({ messages: chat.currentMessages, conversationId: chat.currentConversationId, conversationScopeId: chat.chatScopeId, onMessagesChange }, state, null);
  const viewer = useArtifactViewer()!;
  return <>
    <button onClick={() => void processor.handleSend('¿Qué puedes hacer?', [])}>Enviar</button>
    <button onClick={() => void chat.handleNewChat()}>Nuevo chat</button>
    <button onClick={() => viewer.open([], { kind: 'team', jobId: 'equipo', artifactId: 'archivo' })}>Abrir archivo</button>
    <span data-testid="persistido">{chat.currentConversationId ?? 'borrador'}</span>
    <span data-testid="archivo">{viewer.selected?.kind ?? 'sin archivo'}</span>
    {processor.showLoadingUI && <span role="status">Generando respuesta</span>}
    {chat.currentMessages.map(message => <p key={message.id}>{message.text}</p>)}
  </>;
}

function response(text: string): StreamResult {
  return { stream: (async function* () { yield text; })(), sources: Promise.resolve([]) };
}
async function sendFirstMessage() {
  fireEvent.click(screen.getByText('Enviar'));
  await waitFor(() => expect(screen.getByTestId('persistido')).not.toHaveTextContent('borrador'));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  return (mocks.send.mock.calls[0][2] as { signal: AbortSignal }).signal;
}
beforeEach(() => {
  localStorage.clear(); mocks.send.mockReset();
  mocks.auth.dataUserId = 'usuario'; mocks.auth.user.id = 'usuario';
  mocks.auth.sofiaContext.currentOrganization.id = 'organizacion';
});

describe('primer turno dentro del árbol de la aplicación', () => {
  it('conserva la generación al persistir el borrador y publica la respuesta', async () => {
    let finish!: (result: StreamResult) => void;
    mocks.send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<AppContent />);
    const signal = await sendFirstMessage();
    expect(signal.aborted).toBe(false);
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Generando respuesta');
    await act(async () => finish(response('Puedo ayudarte con tus proyectos.')));
    expect(screen.getByText('Puedo ayudarte con tus proyectos.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
  });

  it('muestra el error del proveedor después de guardar el primer mensaje', async () => {
    let fail!: (error: Error) => void;
    mocks.send.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
    render(<AppContent />);
    await sendFirstMessage();
    await act(async () => fail(new Error('Proveedor no disponible')));
    expect(screen.getByText('No pude completar la respuesta en este momento. Intenta de nuevo.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
  });

  it('abrir otro borrador cancela el turno anterior y limpia el visor', async () => {
    let finish!: (result: StreamResult) => void;
    mocks.send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<AppContent />);
    const signal = await sendFirstMessage();
    fireEvent.click(screen.getByText('Abrir archivo'));
    expect(screen.getByTestId('archivo')).toHaveTextContent('team');
    await act(async () => { fireEvent.click(screen.getByText('Nuevo chat')); });
    expect(signal.aborted).toBe(true);
    expect(screen.getByTestId('archivo')).toHaveTextContent('sin archivo');
    await act(async () => finish(response('Respuesta del chat anterior')));
    expect(screen.queryByText('Respuesta del chat anterior')).not.toBeInTheDocument();
  });

  it.each(['usuario', 'organizacion'])('cambiar %s revoca la generación y el visor anteriores', async scope => {
    let finish!: (result: StreamResult) => void;
    mocks.send.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<AppContent />);
    const signal = await sendFirstMessage();
    fireEvent.click(screen.getByText('Abrir archivo'));
    if (scope === 'usuario') { mocks.auth.user.id = 'otro'; mocks.auth.dataUserId = 'otro'; }
    else mocks.auth.sofiaContext.currentOrganization.id = 'otra';
    view.rerender(<AppContent />);
    expect(signal.aborted).toBe(true);
    expect(screen.getByTestId('archivo')).toHaveTextContent('sin archivo');
    await act(async () => finish(response('Respuesta de la identidad anterior')));
    expect(screen.queryByText('Respuesta de la identidad anterior')).not.toBeInTheDocument();
  });
});
