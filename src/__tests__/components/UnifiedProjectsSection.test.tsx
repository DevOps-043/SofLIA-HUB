import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UnifiedProjectsSection } from '../../components/sidebar/UnifiedProjectsSection';
import { createDefaultProps } from './Sidebar.fixture';

const workspaceA = { id: '62beba2e-d36c-4b2e-a308-4885c53fd7d7', name: 'Empresa Demo', role: 'owner' };
const workspaceB = { id: 'c66c432f-1e7b-427c-8124-bef8f5ed053d', name: 'SofLIA', role: 'owner' };

describe('UnifiedProjectsSection', () => {
  afterEach(() => {
    delete (window as Window & { projectHubApi?: unknown }).projectHubApi;
  });

  it('crea desde un formulario compatible con Electron, sin window.prompt', async () => {
    const createProject = vi.fn().mockResolvedValue({
      success: true,
      data: { project_id: 'f8b9a999-7b76-4c4a-a7ce-3bb6dc7ee7f2' },
    });
    const onOpenUnifiedProject = vi.fn();
    (window as Window & { projectHubApi?: unknown }).projectHubApi = {
      getStatus: vi.fn().mockResolvedValue({
        success: true,
        data: { enabled: true, authenticated: true, workspaces: [workspaceA, workspaceB] },
      }),
      retryAuthentication: vi.fn(),
      listProjects: vi.fn().mockResolvedValue({ success: true, data: [] }),
      createProject,
    };

    render(<UnifiedProjectsSection props={createDefaultProps({ onOpenUnifiedProject })} />);
    await waitFor(() => expect(screen.getByText('Aún no hay proyectos.')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Crear proyecto'));
    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto API' } });
    fireEvent.change(screen.getByLabelText('Workspace'), { target: { value: workspaceB.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith({
      workspaceId: workspaceB.id,
      project: { name: 'Proyecto API', priority: 'medium', tags: [] },
    }));
    await waitFor(() => expect(onOpenUnifiedProject).toHaveBeenCalledWith(
      workspaceB.id,
      'f8b9a999-7b76-4c4a-a7ce-3bb6dc7ee7f2',
    ));
  });
});
