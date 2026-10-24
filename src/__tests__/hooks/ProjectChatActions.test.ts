import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatActions } from "../../hooks/chat-manager/useChatActions";
import type { ChatManagerState } from "../../hooks/chat-manager/types";
import { loadMessages } from "../../services/chat-service";

vi.mock("../../services/chat-service", () => ({
  loadMessages: vi.fn(),
  deleteConversation: vi.fn(),
  updateConversationTitle: vi.fn(),
  toggleConversationPin: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function stateFixture() {
  return {
    scopeVersionRef: { current: 1 },
    currentConvIdRef: { current: "anterior" },
    currentFolderIdRef: { current: "proyecto-a" },
    setCurrentConversationId: vi.fn(),
    setCurrentMessages: vi.fn(),
    conversations: [],
  } as unknown as ChatManagerState;
}
describe("Acciones de conversación con contexto capturado", () => {
  it("no sustituye el chat visible si cambia de proyecto durante el guardado previo", async () => {
    const state = stateFixture();
    let finish!: () => void;
    let current = true;
    const flush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useChatActions({
        state,
        userId: "u",
        flushPendingSave: flush,
        refreshConversationsFromRemote: vi.fn(),
        getCurrentChatStorageKey: (id) => id,
      }),
    );
    let pending!: Promise<string | null>;
    act(() => {
      pending = result.current.handleNewChat("proyecto-a", () => current);
    });
    current = false;
    await act(async () => {
      finish();
      await pending;
    });
    expect(state.setCurrentConversationId).not.toHaveBeenCalled();
    expect(state.currentFolderIdRef.current).toBe("proyecto-a");
    expect(state.scopeVersionRef.current).toBe(1);
  });
  it("descarta los mensajes si cambia de contexto durante la lectura", async () => {
    const state = stateFixture();
    let finish!: () => void;
    let current = true;
    vi.mocked(loadMessages).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve([]);
        }),
    );
    const { result } = renderHook(() =>
      useChatActions({
        state,
        userId: "u",
        flushPendingSave: vi.fn().mockResolvedValue(undefined),
        refreshConversationsFromRemote: vi.fn(),
        getCurrentChatStorageKey: (id) => id,
      }),
    );
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = result.current.handleSelectConversation("otro", () => current);
      await Promise.resolve();
    });
    current = false;
    await act(async () => {
      finish();
      expect(await pending).toBe(false);
    });
    expect(state.setCurrentMessages).not.toHaveBeenCalled();
    expect(state.setCurrentConversationId).not.toHaveBeenCalled();
    expect(state.currentConvIdRef.current).toBe("anterior");
  });
});
