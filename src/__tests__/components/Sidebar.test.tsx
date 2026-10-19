/**
 * Tests UI-003 to UI-014: Sidebar.tsx navigation component.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createDefaultProps, Sidebar } from './Sidebar.fixture';

describe('Sidebar component', () => {
  it('UI-002: renders section title for projects and chats', () => {
    render(<Sidebar {...createDefaultProps()} />);
    expect(screen.getByText('Proyectos y Chats')).toBeInTheDocument();
  });

  it('UI-003: renders sidebar with user info when open', () => {
    render(<Sidebar {...createDefaultProps()} />);
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('UI-004: renders conversation entries when provided', () => {
    render(
      <Sidebar
        {...createDefaultProps({
          conversations: [
            { id: 'c1', user_id: 'u1', title: 'Chat con SofLIA', created_at: '2026-01-01', updated_at: '2026-01-01' },
            { id: 'c2', user_id: 'u1', title: 'Proyecto React', created_at: '2026-01-02', updated_at: '2026-01-02' },
          ],
        })}
      />
    );

    expect(screen.getByText('Chat con SofLIA')).toBeInTheDocument();
    expect(screen.getByText('Proyecto React')).toBeInTheDocument();
  });

  it('UI-014: clicking a conversation triggers onSelectConversation', () => {
    const onSelectConversation = vi.fn();
    render(
      <Sidebar
        {...createDefaultProps({
          conversations: [
            { id: 'c1', user_id: 'u1', title: 'Mi Chat', created_at: '2026-01-01', updated_at: '2026-01-01' },
          ],
          onSelectConversation,
        })}
      />
    );

    fireEvent.click(screen.getByText('Mi Chat'));
    expect(onSelectConversation).toHaveBeenCalledWith('c1');
  });

  it('UI-015: clicking delete in the chat menu does not select the conversation underneath', () => {
    const onDeleteConversation = vi.fn();
    const onSelectConversation = vi.fn();
    const onSetActiveMenuChatId = vi.fn();

    render(
      <Sidebar
        {...createDefaultProps({
          activeMenuChatId: 'c1',
          conversations: [
            {
              id: 'c1',
              user_id: 'u1',
              title: 'Chat con menu',
              created_at: '2026-01-01',
              updated_at: '2026-01-01',
              can_edit: true,
              can_share: true,
            },
          ],
          onDeleteConversation,
          onSelectConversation,
          onSetActiveMenuChatId,
        })}
      />
    );

    const deleteAction = screen.getByText('Eliminar');
    fireEvent.pointerDown(deleteAction);
    fireEvent.click(deleteAction);

    expect(onDeleteConversation).toHaveBeenCalledTimes(1);
    expect(onDeleteConversation.mock.calls[0][0]).toBe('c1');
    expect(onSelectConversation).not.toHaveBeenCalled();
    expect(onSetActiveMenuChatId).toHaveBeenCalledWith(null);
  });

  it('UI-015: el menu explica por que falta el selector de organizacion y deja reintentar', () => {
    const onRetryOrganizations = vi.fn().mockResolvedValue(true);
    render(
      <Sidebar
        {...createDefaultProps({
          organizations: [],
          organizationsUnavailableMessage: 'No se pudo cargar tu organizacion en este momento.',
          onRetryOrganizations,
        })}
      />
    );

    fireEvent.click(screen.getByText('Test User'));
    fireEvent.click(screen.getByText('Reintentar'));

    expect(onRetryOrganizations).toHaveBeenCalledTimes(1);
  });

  it('UI-016: con la sesion caducada el aviso no ofrece reintentar', () => {
    render(
      <Sidebar
        {...createDefaultProps({
          organizations: [],
          organizationsUnavailableMessage: 'Tu sesion con SOFIA caduco.',
          onRetryOrganizations: undefined,
        })}
      />
    );

    fireEvent.click(screen.getByText('Test User'));

    expect(screen.getByText('Tu sesion con SOFIA caduco.')).toBeInTheDocument();
    expect(screen.queryByText('Reintentar')).not.toBeInTheDocument();
  });
});

describe('Menú flotante de conversaciones', () => {
  let triggerRect: DOMRect;
  beforeEach(() => {
    triggerRect = new DOMRect(296, 570, 24, 24);
    vi.stubGlobal('innerWidth', 1024);
    vi.stubGlobal('innerHeight', 600);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.title === 'Mas opciones' ? triggerRect : new DOMRect();
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(148);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(136);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function renderOpenMenu() {
    const props = createDefaultProps({
      activeMenuChatId: 'ultimo',
      conversations: [{ id: 'ultimo', user_id: 'u1', title: 'Último chat', created_at: '2026-01-01', updated_at: '2026-01-01', can_edit: true, can_share: true }],
    });
    render(<Sidebar {...props} />);
    return props;
  }

  it('sale de la lista y abre hacia arriba junto al borde inferior sin desplazarla', () => {
    renderOpenMenu();
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(document.querySelector('nav')).not.toContainElement(menu);
    expect(menu).toHaveStyle({ position: 'fixed', top: '416px', left: '184px' });
    expect(document.querySelector('nav')?.scrollTop).toBe(0);
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
  });

  it.each([0, 1000])('respeta los bordes laterales con el botón en x=%s', left => {
    triggerRect = new DOMRect(left, 20, 24, 24);
    renderOpenMenu();
    const menu = screen.getByRole('menu');
    expect(Number.parseFloat(menu.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(menu.style.left) + 136).toBeLessThanOrEqual(1016);
    expect(menu).toHaveStyle({ top: '50px' });
  });

  it('actualiza el anclaje al desplazar la lista y redimensionar la ventana', () => {
    renderOpenMenu();
    triggerRect = new DOMRect(296, 100, 24, 24);
    fireEvent.scroll(document.querySelector('nav')!);
    expect(screen.getByRole('menu')).toHaveStyle({ top: '130px' });
    triggerRect = new DOMRect(96, 100, 24, 24);
    fireEvent.resize(window);
    expect(screen.getByRole('menu')).toHaveStyle({ left: '8px' });
  });

  it('admite teclado y devuelve el foco al botón con Escape sin seleccionar el chat', () => {
    const props = renderOpenMenu();
    const menu = screen.getByRole('menu');
    const actions = within(menu).getAllByRole('menuitem');
    expect(actions[0]).toHaveFocus();
    fireEvent.keyDown(actions[0], { key: 'ArrowDown' });
    expect(actions[1]).toHaveFocus();
    fireEvent.keyDown(actions[1], { key: 'End' });
    expect(actions[3]).toHaveFocus();
    fireEvent.keyDown(actions[3], { key: 'Home' });
    expect(actions[0]).toHaveFocus();
    fireEvent.keyDown(actions[0], { key: 'Enter' });
    expect(props.onSelectConversation).not.toHaveBeenCalled();
    fireEvent.keyDown(actions[0], { key: 'Escape' });
    expect(props.onSetActiveMenuChatId).toHaveBeenCalledWith(null);
    expect(screen.getByTitle('Mas opciones')).toHaveFocus();
  });

  it('cierra al pulsar fuera y conserva los clics dentro del menú', () => {
    const props = renderOpenMenu();
    fireEvent.pointerDown(within(screen.getByRole('menu')).getByText('Anclar'));
    expect(props.onSetActiveMenuChatId).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(props.onSetActiveMenuChatId).toHaveBeenCalledWith(null);
  });
});
