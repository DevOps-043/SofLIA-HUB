import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserWorkspaceLayout } from '../../components/browser/BrowserWorkspaceLayout';
import { orbService } from '../../services/orb-service';
import { scopedPreferenceKey } from '../../services/user-scope';

vi.mock('../../services/orb-service', () => ({
  orbService: { show: vi.fn(async () => ({ success: true, visible: true })) },
}));

vi.mock('../../components/browser/IntegratedBrowserPanel', () => ({
  IntegratedBrowserPanel: (props: {
    maximized?: boolean;
    viewportInsets?: { left: number; right: number };
    onToggleMaximize?: () => void;
    onContentTopChange?: (offset: number) => void;
  }) => (
    <div>
      <span>{props.maximized ? 'Navegador completo' : 'Navegador con panel'}</span>
      <span data-testid="viewport-insets">{`${props.viewportInsets?.left ?? 0}:${props.viewportInsets?.right ?? 0}`}</span>
      <button onClick={props.onToggleMaximize}>Alternar chat</button>
      <button onClick={() => props.onContentTopChange?.(120)}>Reportar inicio de pagina</button>
    </div>
  ),
}));

describe('BrowserWorkspaceLayout', () => {
  const conversations = [
    { id: 'chat-1', title: 'Resumen del repositorio', updated_at: '2026-08-05T10:00:00.000Z' },
    { id: 'chat-2', title: 'Planeación trimestral', updated_at: '2026-08-04T10:00:00.000Z' },
  ];

  function renderLayout(overrides?: {
    conversations?: typeof conversations;
    onNewChat?: () => Promise<void>;
    onSelectConversation?: (conversationId: string) => Promise<void>;
  }) {
    return render(
      <BrowserWorkspaceLayout
        chat={<div>Chat activo con SofLIA</div>}
        conversations={overrides?.conversations ?? conversations}
        currentConversationId="chat-1"
        onClose={vi.fn()}
        onNewChat={overrides?.onNewChat ?? vi.fn(async () => undefined)}
        onSelectConversation={overrides?.onSelectConversation ?? vi.fn(async () => undefined)}
      />,
    );
  }

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800,
      width: 1200, height: 800, toJSON: () => ({}),
    });
  });

  it('mantiene el navegador vivo, usa chat compacto y permite minimizar sin desmontarlo', () => {
    renderLayout();

    expect(screen.getByRole('region', { name: 'Chat flotante con SofLIA' })).toHaveClass('rounded-[1.75rem]');
    expect(screen.getByText('Navegador con panel')).toBeInTheDocument();
    expect(screen.getByTestId('viewport-insets')).toHaveTextContent('412:0');
    expect(screen.getByRole('button', { name: 'Mover panel a la derecha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minimizar panel de SofLIA' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Minimizar panel de SofLIA' }));

    expect(screen.getByText('Chat activo con SofLIA')).toBeInTheDocument();
    expect(document.querySelector('[aria-label="Chat flotante con SofLIA"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Navegador completo')).toBeInTheDocument();
    expect(screen.getByTestId('viewport-insets')).toHaveTextContent('0:0');
  });

  it('permite cambiar modelo y razonamiento desde el encabezado compacto', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar modelo y razonamiento' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /SofLIA Pro/ }));

    expect(localStorage.getItem(scopedPreferenceKey('soflia:selected-model'))).toBe('gpt-5.6-luna');
    expect(screen.getByRole('button', { name: 'Cambiar modelo y razonamiento' })).toHaveTextContent('SofLIA Pro');
  });

  it('presenta el razonamiento como un slider interactivo y conserva la selección', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar modelo y razonamiento' }));
    const slider = screen.getByRole('slider', { name: 'Nivel de razonamiento' });
    expect(slider).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(localStorage.getItem(scopedPreferenceKey('soflia:thinking-by-model'))).toBeDefined();
  });

  it('mueve el panel al lado derecho y persiste el lado', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Mover panel a la derecha' }));

    expect(screen.getByRole('button', { name: 'Mover panel a la izquierda' })).toBeInTheDocument();
    expect(screen.getByTestId('viewport-insets')).toHaveTextContent('0:412');
    expect(localStorage.getItem(scopedPreferenceKey('sofLia_integratedBrowserFloatingChatSide'))).toBe('right');
  });

  it('ajusta y persiste el ancho del chat con teclado', () => {
    renderLayout();
    const separator = screen.getByRole('separator', { name: 'Ajustar ancho del panel de SofLIA' });

    fireEvent.keyDown(separator, { key: 'ArrowRight' });

    expect(separator).toHaveAttribute('aria-valuenow', '420');
    expect(localStorage.getItem(scopedPreferenceKey('sofLia_integratedBrowserFloatingChatWidth'))).toBe('420');
    expect(screen.getByTestId('viewport-insets')).toHaveTextContent('444:0');
  });

  it('alinea el panel flotante debajo de la barra superior del navegador', () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Reportar inicio de pagina' }));

    expect(screen.getByRole('region', { name: 'Chat flotante con SofLIA' })).toHaveStyle({ top: '132px' });
    expect(screen.getByRole('separator', { name: 'Ajustar ancho del panel de SofLIA' })).toHaveStyle({ top: '144px' });
  });

  it('abre la Orbe general y devuelve todo el ancho al navegador', async () => {
    renderLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Usar Modo Orbe' }));

    await vi.waitFor(() => expect(orbService.show).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.getByText('Navegador completo')).toBeInTheDocument());
    expect(screen.getByTestId('viewport-insets')).toHaveTextContent('0:0');
  });

  it('crea un chat nuevo desde el menú compacto y lo cierra al completar', async () => {
    const onNewChat = vi.fn(async () => undefined);
    renderLayout({ onNewChat });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversaciones' }));
    expect(screen.getByRole('dialog', { name: 'Conversaciones de SofLIA' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo chat' }));

    await vi.waitFor(() => expect(onNewChat).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: 'Conversaciones de SofLIA' })).not.toBeInTheDocument());
  });

  it('busca, cambia de conversación y cierra el menú con Escape', async () => {
    const onSelectConversation = vi.fn(async () => undefined);
    renderLayout({ onSelectConversation });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversaciones' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar chats' }), { target: { value: 'planeacion' } });
    expect(screen.queryByText('Resumen del repositorio')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Planeación trimestral/ }));
    await vi.waitFor(() => expect(onSelectConversation).toHaveBeenCalledWith('chat-2'));

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversaciones' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Conversaciones de SofLIA' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir conversaciones' })).toHaveFocus();
  });

  it('conserva el menú y muestra un error inline si crear el chat falla', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onNewChat = vi.fn(async () => { throw new Error('fallo simulado'); });
    renderLayout({ onNewChat });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo chat' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pude abrir ese chat. Intenta de nuevo.');
    expect(screen.getByRole('dialog', { name: 'Conversaciones de SofLIA' })).toBeInTheDocument();
  });

  it('BR-LAY-001: el asa de ancho queda sobre el panel en ambos lados', () => {
    // La vista nativa del navegador se compone por encima del renderer: si el
    // asa se desplaza hacia el area del navegador, queda tapada.
    renderLayout();
    const separador = screen.getByRole('separator', { name: 'Ajustar ancho del panel de SofLIA' });

    // Panel a la izquierda: el asa debe correrse hacia la izquierda.
    expect(separador.className).toContain('-translate-x-1/2');

    fireEvent.click(screen.getByRole('button', { name: 'Mover panel a la derecha' }));
    const movido = screen.getByRole('separator', { name: 'Ajustar ancho del panel de SofLIA' });

    // Panel a la derecha: se refleja hacia el otro lado.
    expect(movido.className).toContain('translate-x-1/2');
    expect(movido.className).not.toContain('-translate-x-1/2');
  });

  it('reabre automáticamente el panel flotante si estaba minimizado al recibir una selección externa ("Preguntar a SofLIA")', () => {
    const { rerender } = render(
      <BrowserWorkspaceLayout
        chat={<div>Chat activo</div>}
        conversations={conversations}
        currentConversationId="chat-1"
        onClose={vi.fn()}
        onNewChat={vi.fn(async () => undefined)}
        onSelectConversation={vi.fn(async () => undefined)}
      />,
    );

    // Minimizar el panel de chat
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar panel de SofLIA' }));
    expect(document.querySelector('[aria-label="Chat flotante con SofLIA"]')).toHaveAttribute('aria-hidden', 'true');

    // Recibir seleccion externa ("Preguntar a SofLIA")
    rerender(
      <BrowserWorkspaceLayout
        chat={<div>Chat activo</div>}
        conversations={conversations}
        currentConversationId="chat-1"
        externalSelection={{ action: 'ask', text: 'Texto seleccionado', title: 'Gmail', instruction: '' }}
        onClose={vi.fn()}
        onNewChat={vi.fn(async () => undefined)}
        onSelectConversation={vi.fn(async () => undefined)}
      />,
    );

    // El panel de chat vuelve a desplegarse visiblemente
    expect(document.querySelector('[aria-label="Chat flotante con SofLIA"]')).toHaveAttribute('aria-hidden', 'false');
  });
});

