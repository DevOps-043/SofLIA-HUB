import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultProps, Sidebar } from './Sidebar.fixture';
import { isKnownTurnTool } from '../../services/gemini-tools/turn-catalog';
import { SKILL_TOOL_ENTRIES } from '../../shared/skills/tool-registry';

describe('carpetas conservadas después de retirar Project Hub externo', () => {
  it.each(['left', 'right', 'bottom'] as const)('conserva carpeta y chat en la posición %s', position => {
    const onOpenProject = vi.fn();
    const onSelectConversation = vi.fn();
    render(<Sidebar {...createDefaultProps({ position, onOpenProject, onSelectConversation,
      folders: [{ id: 'carpeta-1', user_id: 'usuario', name: 'Mi proyecto guardado', created_at: '2026-01-01', updated_at: '2026-01-01' }],
      expandedFolders: new Set(['carpeta-1']),
      conversations: [{ id: 'chat-1', folder_id: 'carpeta-1', user_id: 'usuario', title: 'Chat conservado', created_at: '2026-01-01', updated_at: '2026-01-01' }],
    })} />);
    if (position === 'bottom') fireEvent.click(screen.getByText('Carpetas'));
    fireEvent.doubleClick(screen.getByText('Mi proyecto guardado'));
    expect(onOpenProject).toHaveBeenCalledWith('carpeta-1');
    fireEvent.click(screen.getAllByText('Chat conservado')[0]);
    expect(onSelectConversation).toHaveBeenCalledWith('chat-1');
    expect(screen.queryByText('WorkSpaces')).not.toBeInTheDocument();
  });
  it('el chat ya no reconoce ni ofrece las herramientas externas retiradas', () => {
    for (const tool of ['get_iris_projects', 'create_iris_issue', 'delete_iris_project']) expect(isKnownTurnTool(tool)).toBe(false);
    expect(SKILL_TOOL_ENTRIES.some(tool => tool.name.includes('iris'))).toBe(false);
  });
});
