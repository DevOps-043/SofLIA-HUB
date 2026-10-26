import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectWorkspace } from "../../app/useProjectWorkspace";
import type { ChatState, FolderState } from "../../app/app-types";
import { resolveProjectChatSpace } from '../../services/project-chat-space';
import { integratedBrowserService } from "../../services/integrated-browser-service";
import { projectHubApi, type ProjectHubProject } from '../../services/project-hub-api';
vi.mock("../../services/project-chat-space", () => ({
  resolveProjectChatSpace: vi.fn(),
}));
vi.mock('../../services/chat', () => ({ loadConversations: vi.fn().mockResolvedValue([]) }));
vi.mock("../../services/integrated-browser-service", () => ({
  integratedBrowserService: {
    isAvailable: vi.fn(() => true),
    navigate: vi.fn(),
  },
}));

const conversation = {
  id: "chat-a",
  user_id: "u",
  folder_id: "a",
  org_id: "org",
  title: "Chat A",
  created_at: "",
  updated_at: "",
};
function setup() {
  return {
    activeView: "project" as const,
    selectionScope: "u/org",
    unifiedProject: null,
    userId: "u",
    orgId: "org",
    browserOpen: false,
    setBrowserOpen: vi.fn(),
    onExit: vi.fn(),
    chat: {
      conversations: [
        conversation,
        { ...conversation, id: "chat-b", folder_id: "b", title: "Chat B" },
      ],
      currentConversationId: null,
      handleNewChat: vi.fn().mockResolvedValue("a"),
      handleSelectConversation: vi.fn().mockResolvedValue(true),
      setConversations: vi.fn(),
    } as unknown as ChatState,
    folder: {
      folders: [
        { id: "a", user_id: "u", org_id: "org", name: "A", can_edit: true },
      ],
      currentFolderId: "a",
      setCurrentFolderId: vi.fn(),
      setFolders: vi.fn(),
    } as unknown as FolderState,
  };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Contexto del proyecto y conversaciones", () => {
  it('verifica el destino si se abre el navegador antes de terminar de cargar el panel', async () => {
    const options = { ...setup(), activeView: 'project-hub' as const, unifiedProject: { workspaceId: 'w', projectId: 'p' } };
    const project = { project_id: 'p', workspace_id: 'w', project_name: 'Proyecto activo', role: 'owner' } as ProjectHubProject;
    vi.spyOn(projectHubApi, 'getProject').mockResolvedValue({ success: true, data: project });
    vi.mocked(resolveProjectChatSpace).mockResolvedValue(null);
    const { result } = renderHook(() => useProjectWorkspace(options));
    act(() => result.current.navigation!.onOpenBrowser());
    await waitFor(() => expect(options.setBrowserOpen).toHaveBeenCalledWith(true));
    expect(result.current.navigation?.browserProject).toEqual({ workspaceId: 'w', projectId: 'p', organizationId: 'org', name: 'Proyecto activo', canWrite: true });
  });
  it('no abre el navegador con la verificación tardía de otro proyecto u organización', async () => {
    const options = { ...setup(), activeView: 'project-hub' as const, unifiedProject: { workspaceId: 'w', projectId: 'p' } };
    let finish!: (value: Awaited<ReturnType<typeof projectHubApi.getProject>>) => void;
    vi.spyOn(projectHubApi, 'getProject').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(props => useProjectWorkspace(props), { initialProps: options });
    act(() => result.current.navigation!.onOpenBrowser());
    rerender({ ...options, orgId: 'otra', selectionScope: 'u/otra', unifiedProject: { workspaceId: 'otro-w', projectId: 'otro-p' } });
    await act(async () => finish({ success: true, data: { project_id: 'p', workspace_id: 'w', project_name: 'Anterior', role: 'owner' } as ProjectHubProject }));
    expect(options.setBrowserOpen).not.toHaveBeenCalledWith(true); expect(result.current.navigation?.browserProject).toBeUndefined();
  });
  it('un fallo de conexión conserva el proyecto y permite reintentar sin abrir el chat global', async () => {
    const options = { ...setup(), activeView: 'project-hub' as const, unifiedProject: { workspaceId: 'w', projectId: 'p' } };
    vi.mocked(resolveProjectChatSpace).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(null);
    const { result } = renderHook(() => useProjectWorkspace(options));
    act(() => result.current.onProjectReady({ project_id: 'p', workspace_id: 'w', project_key: 'P', project_name: 'P', project_status: 'active', priority_level: 'none', health_status: 'none', completion_percentage: 0, updated_at: '', role: 'owner' }));
    await waitFor(() => expect(result.current.navigation?.chatMessage).toContain('Actualizar chats'));
    expect(result.current.navigation?.canCreateChat).toBe(false); expect(options.chat.handleNewChat).not.toHaveBeenCalled();
    act(() => result.current.navigation?.onRetryChats?.());
    await waitFor(() => expect(result.current.navigation?.canCreateChat).toBe(true)); expect(options.chat.setConversations).toHaveBeenCalledWith([]);
  });
  it("filtra chats y prepara los nuevos con el espacio capturado, también desde navegador", async () => {
    const options = setup();
    const { result } = renderHook(() => useProjectWorkspace(options));
    expect(
      result.current.navigation?.conversations.map((row) => row.id),
    ).toEqual(["chat-a"]);
    act(() => result.current.navigation!.onNewChat());
    await waitFor(() =>
      expect(result.current.navigation?.section).toBe("chat"),
    );
    expect(options.chat.handleNewChat).toHaveBeenCalledWith(
      "a",
      expect.any(Function),
    );
    await act(async () => {
      await result.current.navigation?.onBrowserNewChat?.();
    });
    expect(options.chat.handleNewChat).toHaveBeenCalledTimes(2);
    expect(options.setBrowserOpen).not.toHaveBeenCalledWith(true);
  });
  it("ignora selección de un chat ajeno y no reaplica un alta tardía a otro proyecto", async () => {
    const options = setup();
    let finish!: () => void;
    vi.mocked(options.chat.handleNewChat).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve("a");
        }),
    );
    const { result, rerender } = renderHook(
      (props) => useProjectWorkspace(props),
      { initialProps: options },
    );
    act(() => result.current.navigation!.onOpenChat("chat-b"));
    expect(options.chat.handleSelectConversation).not.toHaveBeenCalled();
    act(() => result.current.navigation!.onNewChat());
    const guard = vi.mocked(options.chat.handleNewChat).mock.calls[0][1]!;
    rerender({
      ...options,
      folder: {
        ...options.folder,
        currentFolderId: "b",
        folders: [
          ...options.folder.folders,
          { id: "b", name: "B", user_id: "u", created_at: "", updated_at: "" },
        ],
      },
    });
    expect(guard()).toBe(false);
    await act(async () => finish());
    expect(options.folder.setCurrentFolderId).not.toHaveBeenCalled();
    expect(result.current.navigation?.section).toBe("summary");
  });
  it("retira inmediatamente el contexto al cambiar de actor u organización", () => {
    const options = setup();
    const { result, rerender } = renderHook(
      (props) => useProjectWorkspace(props),
      { initialProps: options },
    );
    rerender({ ...options, userId: "otro" });
    expect(result.current.navigation).toBeUndefined();
  });
  it("prepara un espacio persistente al crear chat sin vínculo federado y no cae al chat general", async () => {
    const options = {
      ...setup(),
      activeView: "project-hub" as const,
      unifiedProject: { workspaceId: "w", projectId: "p" },
    };
    vi.mocked(resolveProjectChatSpace).mockResolvedValueOnce(null).mockResolvedValue({ id: 'personal', user_id: 'u', org_id: 'org', name: 'P', can_edit: true, created_at: '', updated_at: '' });
    const { result } = renderHook(() => useProjectWorkspace(options));
    act(() =>
      result.current.onProjectReady({
        project_id: "p",
        workspace_id: "w",
        project_key: "P",
        project_name: "P",
        project_status: "active",
        priority_level: "none",
        health_status: "none",
        completion_percentage: 0,
        updated_at: "",
        role: "owner",
      }),
    );
    await waitFor(() =>
      expect(result.current.navigation?.canCreateChat).toBe(true),
    );
    expect(result.current.navigation?.conversations).toEqual([]);
    expect(result.current.navigation?.browserProject).toEqual({ workspaceId: 'w', projectId: 'p', organizationId: 'org', name: 'P', canWrite: true });
    act(() => result.current.navigation!.onNewChat());
    await waitFor(() => expect(options.chat.handleNewChat).toHaveBeenCalledWith('personal', expect.any(Function)));
    expect(resolveProjectChatSpace).toHaveBeenLastCalledWith(expect.objectContaining({ workspaceId: 'w', projectId: 'p', userId: 'u', orgId: 'org', create: true }));
    await waitFor(() => expect(result.current.navigation?.section).toBe('chat'));
    expect(integratedBrowserService.isAvailable).not.toHaveBeenCalled();
  });
});
