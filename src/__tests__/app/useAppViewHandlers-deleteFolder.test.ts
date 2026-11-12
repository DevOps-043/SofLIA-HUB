import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppViewHandlers } from '../../app/useAppViewHandlers';
import type { MouseEvent } from 'react';
import type { ChatState, FolderState } from '../../app/app-types';

describe('useAppViewHandlers - eliminación de carpetas con modal en la app', () => {
  it('abre el modal seteando deletingFolderId sin invocar window.confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const setDeletingFolderId = vi.fn();
    const handleDeleteFolder = vi.fn();
    const folder = {
      folders: [{ id: 'f-1', name: 'Soflia Hub' }],
      deletingFolderId: null,
      setDeletingFolderId,
      handleDeleteFolder,
      currentFolderId: null,
      setCurrentFolderId: vi.fn(),
    } as unknown as FolderState;

    const { result } = renderHook(() =>
      useAppViewHandlers({
        activeView: 'chat',
        chat: {} as ChatState,
        folder,
        setActiveView: vi.fn(),
        setExternalPrompt: vi.fn(),
      })
    );

    const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
    act(() => {
      void result.current.handleDeleteFolder('f-1', event);
    });

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(setDeletingFolderId).toHaveBeenCalledWith('f-1');
  });

  it('handleConfirmDeleteFolder ejecuta el borrado, cierra el modal y redirige si era la carpeta activa', async () => {
    const handleDeleteFolderMock = vi.fn().mockResolvedValue(true);
    const setDeletingFolderId = vi.fn();
    const setCurrentFolderId = vi.fn();
    const setActiveView = vi.fn();

    const folder = {
      folders: [{ id: 'f-1', name: 'Soflia Hub' }],
      deletingFolderId: 'f-1',
      setDeletingFolderId,
      handleDeleteFolder: handleDeleteFolderMock,
      currentFolderId: 'f-1',
      setCurrentFolderId,
    } as unknown as FolderState;

    const { result } = renderHook(() =>
      useAppViewHandlers({
        activeView: 'project',
        chat: {} as ChatState,
        folder,
        setActiveView,
        setExternalPrompt: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.handleConfirmDeleteFolder();
    });

    expect(setDeletingFolderId).toHaveBeenCalledWith(null);
    expect(handleDeleteFolderMock).toHaveBeenCalledWith('f-1');
    expect(setCurrentFolderId).toHaveBeenCalledWith(null);
    expect(setActiveView).toHaveBeenCalledWith('chat');
  });

  it('handleCancelDeleteFolder limpia deletingFolderId sin borrar', () => {
    const handleDeleteFolderMock = vi.fn();
    const setDeletingFolderId = vi.fn();

    const folder = {
      folders: [{ id: 'f-1', name: 'Soflia Hub' }],
      deletingFolderId: 'f-1',
      setDeletingFolderId,
      handleDeleteFolder: handleDeleteFolderMock,
      currentFolderId: null,
      setCurrentFolderId: vi.fn(),
    } as unknown as FolderState;

    const { result } = renderHook(() =>
      useAppViewHandlers({
        activeView: 'chat',
        chat: {} as ChatState,
        folder,
        setActiveView: vi.fn(),
        setExternalPrompt: vi.fn(),
      })
    );

    act(() => {
      result.current.handleCancelDeleteFolder();
    });

    expect(setDeletingFolderId).toHaveBeenCalledWith(null);
    expect(handleDeleteFolderMock).not.toHaveBeenCalled();
  });
});
