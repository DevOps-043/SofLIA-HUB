import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectWorkspaceCompletion, workspaceIncompleteMessage } from '../../services/gemini-chat/workspace-completion';

const PRESENTACIONES = {
  id: 'sistema:presentaciones',
  tools: [],
  workspaceId: 'ws-1',
};

describe('condicion de salida de un workspace', () => {
  afterEach(() => {
    delete (window as unknown as { skillWorkspace?: unknown }).skillWorkspace;
  });

  it('exige seguir cuando el documento de entrada no existe', async () => {
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = {
      getState: vi.fn().mockResolvedValue({
        success: true,
        state: { ready: false, workspace: { entryFile: 'deck.json' } },
      }),
    };

    await expect(inspectWorkspaceCompletion(PRESENTACIONES)).resolves.toMatchObject({
      required: true,
      ready: false,
      message: expect.stringContaining('deck.json'),
    });
  });

  it('acepta el cierre cuando main confirma que el deck esta listo', async () => {
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = {
      getState: vi.fn().mockResolvedValue({
        success: true,
        state: { ready: true, workspace: { entryFile: 'deck.json' } },
      }),
    };

    await expect(inspectWorkspaceCompletion(PRESENTACIONES)).resolves.toEqual({ required: true, ready: true });
  });

  it('identifica un audiovisual incompleto sin pedir un deck', async () => {
    const audiovisual = { ...PRESENTACIONES, id: 'sistema:audiovisual' };
    (window as unknown as { skillWorkspace: unknown }).skillWorkspace = { getState: vi.fn().mockResolvedValue({ success: true, state: { ready: false, workspace: { entryFile: 'film.json' } } }) };
    await expect(inspectWorkspaceCompletion(audiovisual)).resolves.toMatchObject({ required: true, ready: false, message: expect.stringContaining('MP4 con QA válido') });
    expect(workspaceIncompleteMessage(audiovisual)).toContain('MP4 verificado');
    expect(workspaceIncompleteMessage(audiovisual)).not.toContain('deck');
    expect(workspaceIncompleteMessage(PRESENTACIONES)).toContain('deck.json');
  });
  it('no condiciona otras Skills', async () => {
    await expect(inspectWorkspaceCompletion({ ...PRESENTACIONES, id: 'sistema:otra' })).resolves.toEqual({
      required: false,
      ready: true,
    });
  });
});
