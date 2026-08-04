/**
 * Tests UI-003 to UI-014: Sidebar.tsx navigation component.
 */
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultProps, Sidebar } from './Sidebar.fixture';

describe('Sidebar component', () => {
  it('UI-002: abre el navegador integrado desde la navegacion principal', () => {
    const onOpenBrowser = vi.fn();
    render(<Sidebar {...createDefaultProps({ onOpenBrowser })} />);
    fireEvent.click(screen.getByText('Navegador'));
    expect(onOpenBrowser).toHaveBeenCalledTimes(1);
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
            { id: 'c1', user_id: 'u1', title: 'Chat con Pulse', created_at: '2026-01-01', updated_at: '2026-01-01' },
            { id: 'c2', user_id: 'u1', title: 'Proyecto React', created_at: '2026-01-02', updated_at: '2026-01-02' },
          ],
        })}
      />
    );

    expect(screen.getByText('Chat con Pulse')).toBeInTheDocument();
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
});
