import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { DeleteFolderModal } from '../../components/folder-modals/DeleteFolderModal';
import type { Folder } from '../../services/folder-service';

const FOLDER_MOCK: Folder = {
  id: 'f-123',
  user_id: 'u-1',
  name: 'Soflia Hub',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  can_share: true,
  can_edit: true,
};

describe('DeleteFolderModal', () => {
  it('no se renderiza si isOpen es falso o folder es nulo', () => {
    const onConfirm = vi.fn();
    const { container, rerender } = render(
      <DeleteFolderModal isOpen={false} folder={FOLDER_MOCK} onClose={vi.fn()} onConfirm={onConfirm} />
    );
    expect(container.firstChild).toBeNull();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(<DeleteFolderModal isOpen={true} folder={null} onClose={vi.fn()} onConfirm={onConfirm} />);
    expect(container.firstChild).toBeNull();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('muestra el titulo con el nombre entre comillas y el mensaje descriptivo', () => {
    render(<DeleteFolderModal isOpen={true} folder={FOLDER_MOCK} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText('Eliminar "Soflia Hub"?')).toBeInTheDocument();
    expect(
      screen.getByText(/Sus chats se conservan y pasan a/i)
    ).toBeInTheDocument();
    expect(screen.getByText('"Sin carpeta"')).toBeInTheDocument();
    expect(
      screen.getByText(/Las fuentes de la carpeta y los accesos compartidos se eliminan/i)
    ).toBeInTheDocument();
  });

  it('usa fallback si la carpeta no tiene nombre', () => {
    const sinNombre = { ...FOLDER_MOCK, name: '' };
    render(<DeleteFolderModal isOpen={true} folder={sinNombre} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText('Eliminar esta carpeta?')).toBeInTheDocument();
  });

  it('llama a onClose al presionar Cancelar o la X de cierre', () => {
    const onClose = vi.fn();
    render(<DeleteFolderModal isOpen={true} folder={FOLDER_MOCK} onClose={onClose} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('llama a onConfirm al presionar Eliminar', async () => {
    const onConfirm = vi.fn();
    render(<DeleteFolderModal isOpen={true} folder={FOLDER_MOCK} onClose={vi.fn()} onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cierra con la tecla Escape y confirma con Enter', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<DeleteFolderModal isOpen={true} folder={FOLDER_MOCK} onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirma con el callback vigente después de actualizar el modal', async () => {
    const previousConfirm = vi.fn();
    const currentConfirm = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <DeleteFolderModal isOpen={true} folder={FOLDER_MOCK} onClose={onClose} onConfirm={previousConfirm} />
    );
    rerender(<DeleteFolderModal isOpen={true} folder={FOLDER_MOCK} onClose={onClose} onConfirm={currentConfirm} />);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(previousConfirm).not.toHaveBeenCalled();
    expect(currentConfirm).toHaveBeenCalledTimes(1);
  });
});
