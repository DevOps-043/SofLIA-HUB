/**
 * Tests FM-001 a FM-006: reglas de la edicion inline del nombre de carpeta.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const servicio = vi.hoisted(() => ({
  loadFolders: vi.fn(async () => []),
  createFolder: vi.fn(),
  renameFolder: vi.fn(async () => true),
  deleteFolder: vi.fn(async () => true),
  moveChatToFolder: vi.fn(async () => true),
}));

vi.mock('../../services/folder-service', () => servicio);

const { useFolderManager } = await import('../../hooks/useFolderManager');

const CARPETA_PROPIA = {
  id: 'f1',
  user_id: 'u1',
  name: 'Cosas',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  can_share: true,
  can_edit: true,
};

const CARPETA_RECIBIDA = { ...CARPETA_PROPIA, id: 'f2', name: 'Recibida', is_shared: true, can_share: false };

async function montarCon(folders: any[]) {
  servicio.loadFolders.mockResolvedValue(folders as never);
  const hook = renderHook(() => useFolderManager({
    userId: 'u1',
    conversations: [],
    setConversations: vi.fn(),
  }));
  await act(async () => { await hook.result.current.loadInitialFolders(); });
  await waitFor(() => expect(hook.result.current.folders).toHaveLength(folders.length));
  return hook;
}

describe('Renombrado de carpetas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    servicio.renameFolder.mockResolvedValue(true as never);
  });

  it('FM-001: abrir la edicion precarga el nombre actual', async () => {
    const { result } = await montarCon([CARPETA_PROPIA]);

    act(() => result.current.startFolderRename('f1'));

    expect(result.current.renamingFolderId).toBe('f1');
    expect(result.current.editingFolderName).toBe('Cosas');
  });

  it('FM-002: una carpeta recibida no entra en edicion', async () => {
    const { result } = await montarCon([CARPETA_RECIBIDA]);

    act(() => result.current.startFolderRename('f2'));

    expect(result.current.renamingFolderId).toBeNull();
  });

  it('FM-003: confirmar un nombre nuevo lo persiste', async () => {
    const { result } = await montarCon([CARPETA_PROPIA]);

    act(() => result.current.startFolderRename('f1'));
    act(() => result.current.setEditingFolderName('Cosas nuevas'));
    await act(async () => { await result.current.commitFolderRename(); });

    expect(servicio.renameFolder).toHaveBeenCalledWith('u1', 'f1', 'Cosas nuevas');
    expect(result.current.renamingFolderId).toBeNull();
  });

  it('FM-004: un nombre vacio cierra sin escribir', async () => {
    const { result } = await montarCon([CARPETA_PROPIA]);

    act(() => result.current.startFolderRename('f1'));
    act(() => result.current.setEditingFolderName('   '));
    await act(async () => { await result.current.commitFolderRename(); });

    expect(servicio.renameFolder).not.toHaveBeenCalled();
    expect(result.current.renamingFolderId).toBeNull();
  });

  it('FM-005: confirmar el mismo nombre no genera escritura', async () => {
    const { result } = await montarCon([CARPETA_PROPIA]);

    act(() => result.current.startFolderRename('f1'));
    await act(async () => { await result.current.commitFolderRename(); });

    expect(servicio.renameFolder).not.toHaveBeenCalled();
  });

  it('FM-006: cancelar descarta la edicion sin escribir', async () => {
    const { result } = await montarCon([CARPETA_PROPIA]);

    act(() => result.current.startFolderRename('f1'));
    act(() => result.current.setEditingFolderName('Otro nombre'));
    act(() => result.current.cancelFolderRename());

    expect(servicio.renameFolder).not.toHaveBeenCalled();
    expect(result.current.renamingFolderId).toBeNull();
    expect(result.current.folders[0].name).toBe('Cosas');
  });
});
