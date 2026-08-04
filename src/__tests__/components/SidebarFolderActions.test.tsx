/**
 * Tests UI-060 a UI-067: renombrar y eliminar carpetas desde la barra lateral.
 */
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createDefaultProps, Sidebar } from './Sidebar.fixture';

const CARPETA_PROPIA = {
  id: 'f1',
  user_id: 'u1',
  name: 'Cosas',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  can_share: true,
  can_edit: true,
};

/** Carpeta compartida CON el usuario: no es suya, no puede tocarla. */
const CARPETA_RECIBIDA = {
  ...CARPETA_PROPIA,
  id: 'f2',
  name: 'Recibida',
  is_shared: true,
  can_share: false,
  can_edit: false,
};

describe('Acciones de carpeta en la barra lateral', () => {
  it('UI-060: una carpeta propia ofrece renombrar y eliminar', () => {
    render(<Sidebar {...createDefaultProps({ folders: [CARPETA_PROPIA] as any })} />);

    expect(screen.getByTitle('Renombrar carpeta')).toBeInTheDocument();
    expect(screen.getByTitle('Eliminar carpeta')).toBeInTheDocument();
  });

  it('UI-061: una carpeta recibida no ofrece ninguna de las dos', () => {
    render(<Sidebar {...createDefaultProps({ folders: [CARPETA_RECIBIDA] as any })} />);

    expect(screen.queryByTitle('Renombrar carpeta')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar carpeta')).not.toBeInTheDocument();
  });

  it('UI-062: el boton de renombrar abre la edicion de esa carpeta', () => {
    const onStartRenameFolder = vi.fn();
    render(<Sidebar {...createDefaultProps({ folders: [CARPETA_PROPIA] as any, onStartRenameFolder })} />);

    fireEvent.click(screen.getByTitle('Renombrar carpeta'));

    expect(onStartRenameFolder).toHaveBeenCalledWith('f1');
  });

  it('UI-063: renombrar no despliega ni abre la carpeta', () => {
    const onToggleFolder = vi.fn();
    const onOpenProject = vi.fn();
    render(<Sidebar {...createDefaultProps({ folders: [CARPETA_PROPIA] as any, onToggleFolder, onOpenProject })} />);

    fireEvent.click(screen.getByTitle('Renombrar carpeta'));

    expect(onToggleFolder).not.toHaveBeenCalled();
    expect(onOpenProject).not.toHaveBeenCalled();
  });

  it('UI-064: en edicion se muestra el input con el nombre en curso', () => {
    render(
      <Sidebar
        {...createDefaultProps({
          folders: [CARPETA_PROPIA] as any,
          renamingFolderId: 'f1',
          editingFolderName: 'Cosas editadas',
        })}
      />,
    );

    expect(screen.getByDisplayValue('Cosas editadas')).toBeInTheDocument();
  });

  it('UI-065: Enter confirma y Escape cancela', () => {
    const onFinishRenameFolder = vi.fn();
    const onCancelRenameFolder = vi.fn();
    render(
      <Sidebar
        {...createDefaultProps({
          folders: [CARPETA_PROPIA] as any,
          renamingFolderId: 'f1',
          editingFolderName: 'Nuevo',
          onFinishRenameFolder,
          onCancelRenameFolder,
        })}
      />,
    );
    const input = screen.getByDisplayValue('Nuevo');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onFinishRenameFolder).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancelRenameFolder).toHaveBeenCalledTimes(1);
  });

  it('UI-066: escribir en el input propaga el nombre editado', () => {
    const onSetEditingFolderName = vi.fn();
    render(
      <Sidebar
        {...createDefaultProps({
          folders: [CARPETA_PROPIA] as any,
          renamingFolderId: 'f1',
          editingFolderName: 'Cosas',
          onSetEditingFolderName,
        })}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Cosas'), { target: { value: 'Cosas nuevas' } });

    expect(onSetEditingFolderName).toHaveBeenCalledWith('Cosas nuevas');
  });

  it('UI-067: clicar la fila mientras se edita no despliega la carpeta', () => {
    const onToggleFolder = vi.fn();
    render(
      <Sidebar
        {...createDefaultProps({
          folders: [CARPETA_PROPIA] as any,
          renamingFolderId: 'f1',
          editingFolderName: 'Cosas',
          onToggleFolder,
        })}
      />,
    );

    fireEvent.click(screen.getByDisplayValue('Cosas'));

    expect(onToggleFolder).not.toHaveBeenCalled();
  });
});
