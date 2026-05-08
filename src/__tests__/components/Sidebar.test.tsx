/**
 * Tests UI-003 to UI-014: Sidebar.tsx navigation component.
 */
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultProps, Sidebar } from './Sidebar.fixture';

describe('Sidebar component', () => {
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
});
