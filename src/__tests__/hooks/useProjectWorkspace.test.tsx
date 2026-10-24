import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectWorkspace } from "../../app/useProjectWorkspace";
import type { ChatState, FolderState } from "../../app/app-types";
import { readProjectChatBinding } from "../../services/project-chat-binding";
import { integratedBrowserService } from "../../services/integrated-browser-service";
vi.mock("../../services/project-chat-binding", () => ({
  readProjectChatBinding: vi.fn(),
}));
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
    } as unknown as ChatState,
    folder: {
      folders: [
        { id: "a", user_id: "u", org_id: "org", name: "A", can_edit: true },
      ],
      currentFolderId: "a",
      setCurrentFolderId: vi.fn(),
    } as unknown as FolderState,
  };
}
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe("Contexto del proyecto y conversaciones", () => {
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
  it("no inventa una carpeta ni cae al chat general cuando falta el vínculo de gestión", async () => {
    const options = {
      ...setup(),
      activeView: "project-hub" as const,
      unifiedProject: { workspaceId: "w", projectId: "p" },
    };
    vi.mocked(readProjectChatBinding).mockResolvedValue(null);
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
      expect(result.current.navigation?.chatMessage).toContain(
        "todavía no está preparado",
      ),
    );
    expect(result.current.navigation?.canCreateChat).toBe(false);
    expect(result.current.navigation?.conversations).toEqual([]);
    act(() => result.current.navigation!.onNewChat());
    expect(options.chat.handleNewChat).not.toHaveBeenCalled();
    expect(integratedBrowserService.isAvailable).not.toHaveBeenCalled();
  });
});
