import { useState, type ComponentProps, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppWorkspace } from '../../app/AppWorkspace';
import type { AppChatView } from '../../app/AppChatView';
import { useChatProcessor } from '../../hooks/useChatProcessor';
import type { ChatMessage } from '../../services/chat-service';
import type { StreamResult } from '../../services/gemini-chat';

const send = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<StreamResult>>());
vi.mock('../../services/gemini-chat', () => ({ sendMessageStream: send, getPublicAiErrorMessage: () => 'La navegación quedó interrumpida.' }));
vi.mock('../../services/image-generation', () => ({ generateImage: vi.fn() }));
vi.mock('../../services/iris-data', () => ({ needsIrisData: () => false }));
vi.mock('../../services/memory-bridge', () => ({ fetchChatMemoryContext: async () => '', recordChatTurn: vi.fn() }));

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
  AppChatView: ChatWithProcessor,
}));

function ChatWithProcessor({ floating, compact, readVisibleContext, chat, onMessagesChange }: ComponentProps<typeof AppChatView>) {
  const messages = chat.currentMessages ?? [];
  const processor = useChatProcessor({ messages, onMessagesChange, preferredPrimaryModel: 'gpt-6.1-terra', thinkingMode: 'high',
    isImageGenMode: false, isPromptOptimizerMode: false, optimizerTarget: 'chatgpt', activeSkill: null, memorySessionScope: 'conversacion' });
  return <div data-testid="chat" data-floating={String(floating)} data-compact={String(compact)} data-context={String(!!readVisibleContext)}>
    <button onClick={() => void processor.handleSend('Abre el navegador y descarga el archivo.', [])}>Enviar encargo</button>
    <button onClick={() => void processor.handleEditMessage('original', 'Abre el navegador y mueve la descarga.')}>Editar y reenviar</button>
    {messages.map(message => <p key={message.id}>{message.text}</p>)}
  </div>;
}

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
  it.each(['envío nuevo', 'edición', 'reenvío de un turno interrumpido', 'error de navegación'])('continúa el turno tras abrir el navegador durante %s', async (scenario) => {
    const edited = scenario === 'edición' || scenario === 'reenvío de un turno interrumpido';
    let finish!: (result: StreamResult) => void;
    let fail!: (error: Error) => void;
    send.mockReset().mockImplementation(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir navegador de prueba' }));
      return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    });
    function Workspace() {
      const [browserWorkspaceOpen, setBrowserOpen] = useState(false);
      const text = scenario === 'edición' ? 'Mensaje por editar' : 'Abre el navegador y mueve la descarga.';
      const [messages, setMessages] = useState<ChatMessage[]>(edited ? [{ id: 'original', role: 'user', text, timestamp: 1 }] : []);
      const props = {
        activeView: 'chat', userId: 'usuario', orgId: 'organizacion', browserWorkspaceOpen,
        chat: { conversations: [], currentConversationId: 'conversacion', currentMessages: messages },
        onMessagesChange: setMessages, folder: {}, currentConversation: null,
        liaDegraded: false, shareLinkNotice: null, userSettings: null,
      } as unknown as Props;
      return <><button onClick={() => setBrowserOpen(true)}>Abrir navegador de prueba</button><AppWorkspace {...props} /></>;
    }
    render(<Workspace />);
    const originalChat = screen.getByTestId('chat');
    fireEvent.click(screen.getByRole('button', { name: edited ? 'Editar y reenviar' : 'Enviar encargo' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Navegador lateral' })).toContainElement(originalChat));
    const { signal } = send.mock.calls[0][2] as { signal: AbortSignal };
    expect(signal.aborted).toBe(false);
    if (scenario === 'error de navegación') {
      await act(async () => fail(new Error('Se cerró la pestaña.')));
      expect(screen.getByText('La navegación quedó interrumpida.')).toBeVisible();
    } else {
      await act(async () => finish({ stream: (async function* () { yield 'Archivo confirmado en el Escritorio.'; })(), sources: Promise.resolve([]) }));
      expect(screen.getByText('Archivo confirmado en el Escritorio.')).toBeVisible();
    }
    if (edited) {
      expect(screen.queryByText('Mensaje por editar')).not.toBeInTheDocument();
      expect(screen.getAllByText('Abre el navegador y mueve la descarga.')).toHaveLength(1);
    }
  });

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
