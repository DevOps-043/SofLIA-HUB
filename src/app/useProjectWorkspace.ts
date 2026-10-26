import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ActiveView, ChatState, FolderState } from "./app-types";
import type { ProjectHubProject } from "../services/project-hub-api";
import { projectHubApi } from '../services/project-hub-api';
import { resolveProjectChatSpace } from '../services/project-chat-space';
import type { Folder } from '../services/folder-service';
import { loadConversations } from '../services/chat';
import { integratedBrowserService } from "../services/integrated-browser-service";
import { safeWebUrl } from "../services/project-web-url";
import type {
  ProjectNavigation,
  ProjectSection,
} from "../components/project-workspace/types";

interface Options {
  selectionScope: string | null;
  activeView: ActiveView;
  unifiedProject: { workspaceId: string; projectId: string } | null;
  chat: ChatState;
  folder: FolderState;
  userId?: string;
  orgId: string;
  browserOpen: boolean;
  setBrowserOpen: (open: boolean) => void;
  onExit: () => void;
}
export function useProjectWorkspace(options: Options) {
  const {
    activeView,
    unifiedProject,
    chat,
    folder,
    userId,
    orgId,
    browserOpen,
    setBrowserOpen,
    onExit,
  } = options;
  const currentFolder =
    activeView === "project"
      ? folder.folders.find((item) => item.id === folder.currentFolderId)
      : undefined;
  const active =
    options.selectionScope === userId + "/" + orgId &&
    !!userId &&
    ((activeView === "project-hub" && !!unifiedProject) ||
      (activeView === "project" && !!currentFolder));
  const key = active
    ? `${userId}/${orgId}/${activeView}/${activeView === "project-hub" ? unifiedProject?.workspaceId + "/" + unifiedProject?.projectId : currentFolder?.id}`
    : "";
  const scopeRef = useRef(key);
  useLayoutEffect(() => {
    scopeRef.current = key;
    return () => {
      scopeRef.current = "";
    };
  }, [key]);
  const [selection, setSelection] = useState<{
    key: string;
    section: ProjectSection;
  }>({ key: "", section: "summary" });
  const [verified, setVerified] = useState<{
    key: string;
    project: ProjectHubProject;
  } | null>(null);
  const [binding, setBinding] = useState<{
    key: string;
    id: string | null;
    error?: string;
    folder?: Folder;
  }>({ key: "", id: null });
  const [chatRevision, setChatRevision] = useState(0);
  const preparing = useRef<{ key: string; promise: Promise<Folder | null>; abort: AbortController } | null>(null);
  useEffect(() => () => { preparing.current?.abort.abort(); preparing.current = null; }, [key]);
  const [notice, setNotice] = useState<{ key: string; message: string } | null>(
    null,
  );
  const onProjectReady = useCallback(
    (project: ProjectHubProject) => {
      if (key && scopeRef.current === key) setVerified({ key, project });
    },
    [key],
  );
  const project = verified?.key === key ? verified.project : null;
  useEffect(() => {
    if (!active || activeView !== "project-hub" || !unifiedProject || !project)
      return undefined;
    const abort = new AbortController();
    void resolveProjectChatSpace({ ...unifiedProject, userId: userId!, orgId, name: project.project_name, create: false, signal: abort.signal })
      .then((resolved) => {
        if (!abort.signal.aborted) setBinding({ key, id: resolved?.id || null, folder: resolved || undefined });
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setBinding({
            key,
            id: null,
            error:
              "No se pudieron cargar tus chats del proyecto. Comprueba la conexión y pulsa Actualizar chats.",
          });
      });
    return () => abort.abort();
  }, [active, activeView, key, project, unifiedProject, userId, orgId, chatRevision]);
  const chatFolder = !active
    ? undefined
    : activeView === "project"
      ? currentFolder
      : binding.key === key
        ? folder.folders.find((item) => item.id === binding.id && (!item.org_id || item.org_id === orgId)) || binding.folder
        : undefined;
  const conversations =
    active && chatFolder
      ? chat.conversations
          .filter(
            (item) =>
              item.folder_id === chatFolder.id &&
              !item.deleted_at &&
              (!item.org_id || item.org_id === orgId),
          )
          .sort(
            (a, b) =>
              Number(!!b.is_pinned) - Number(!!a.is_pinned) ||
              b.updated_at.localeCompare(a.updated_at),
          )
      : [];
  const role = project?.role ?? project?.membership?.project_role;
  const canCreateChat =
    (chatFolder ? chatFolder.can_edit !== false : binding.key === key && !binding.error) &&
    (activeView === "project" ||
      ["owner", "admin", "member"].includes(role || ""));
  const chatMessage =
    notice?.key === key
      ? notice.message
      : activeView === "project-hub" && !chatFolder
        ? binding.key === key
          ? binding.error || (canCreateChat ? undefined : 'Este proyecto no tiene chats disponibles para tu acceso.')
          : "Comprobando el espacio de chats…"
        : canCreateChat
          ? undefined
          : "Este espacio de chats es de sólo lectura.";
  const navigate = (section: ProjectSection) => {
    setBrowserOpen(false);
    setSelection({ key, section });
  };
  const prepareChat = async () => {
    if (!canCreateChat) return false;
    const captured = key;
    let destination = chatFolder;
    if (!destination && unifiedProject && project && userId) {
      if (!preparing.current || preparing.current.key !== key) {
        const abort = new AbortController();
        preparing.current = { key, abort, promise: resolveProjectChatSpace({ ...unifiedProject, userId, orgId, name: project.project_name, create: true, signal: abort.signal }) };
      }
      const pending = preparing.current;
      try { destination = await pending.promise || undefined; } finally { if (preparing.current === pending) preparing.current = null; }
      if (scopeRef.current !== captured || !destination) return false;
      setBinding({ key, id: destination.id, folder: destination });
      const resolved = destination;
      folder.setFolders(previous => previous.some(item => item.id === resolved.id) ? previous : [resolved, ...previous]);
    }
    if (!destination) return false;
    await chat.handleNewChat(
      destination.id,
      () => scopeRef.current === captured,
    );
    if (scopeRef.current !== captured) return false;
    folder.setCurrentFolderId(destination.id);
    return true;
  };
  const onNewChat = () => {
    void prepareChat()
      .then((ready) => {
        if (ready && scopeRef.current === key) {
          setBrowserOpen(false);
          setSelection({ key, section: "chat" });
        }
      })
      .catch(() => {
        if (scopeRef.current === key)
          setNotice({
            key,
            message:
              "No se pudo preparar la conversación. Reintenta desde Nuevo chat.",
          });
      });
  };
  const openChat = async (id: string, keepBrowser = false) => {
    if (!chatFolder || !conversations.some((item) => item.id === id)) return;
    const captured = key;
    await chat
      .handleSelectConversation(id, () => scopeRef.current === captured)
      .then((selected) => {
        if (!selected || scopeRef.current !== captured) return;
        folder.setCurrentFolderId(chatFolder.id);
        if (!keepBrowser) {
          setBrowserOpen(false);
          setSelection({ key, section: "chat" });
        }
      })
      .catch(() => {
        if (scopeRef.current === captured)
          setNotice({ key, message: "No se pudo abrir la conversación." });
      });
  };
  const openBrowser = async () => {
    if (!integratedBrowserService.isAvailable()) {
      setNotice({
        key,
        message: "El navegador integrado no está disponible en esta sesión.",
      });
      return false;
    }
    if (activeView === 'project-hub' && unifiedProject && !project) {
      const result = await projectHubApi.getProject(unifiedProject.workspaceId, unifiedProject.projectId);
      if (scopeRef.current !== key) return false;
      if (!result.success || result.data?.project_id !== unifiedProject.projectId || result.data?.workspace_id !== unifiedProject.workspaceId) {
        setNotice({ key, message: result.error || 'No se pudo comprobar el proyecto antes de abrir el navegador.' });
        return false;
      }
      setVerified({ key, project: result.data });
    }
    if (
      !conversations.some((item) => item.id === chat.currentConversationId) &&
      canCreateChat &&
      !(
        folder.currentFolderId === chatFolder?.id && !chat.currentConversationId
      )
    )
      await prepareChat();
    if (scopeRef.current !== key) return false;
    setBrowserOpen(true);
    return true;
  };
  const onOpenWeb = (url: string) => {
    const safe = safeWebUrl(url);
    if (!safe) return;
    void openBrowser()
      .then(async (opened) => {
        if (!opened || scopeRef.current !== key) return;
        const result = await integratedBrowserService.navigate(safe);
        if (!result.success && scopeRef.current === key)
          setNotice({
            key,
            message: result.error || "No se pudo abrir la página.",
          });
      })
      .catch(() => {
        if (scopeRef.current === key)
          setNotice({ key, message: "No se pudo abrir la página." });
      });
  };
  const navigation: ProjectNavigation | undefined = active
    ? {
        browserProject: activeView === 'project-hub' && project && unifiedProject ? { ...unifiedProject, organizationId: orgId, name: project.project_name, canWrite: ['owner', 'admin', 'member'].includes(role || '') } : undefined,
        name:
          activeView === "project"
            ? currentFolder!.name
            : project?.project_name || "Proyecto",
        section: selection.key === key ? selection.section : "summary",
        conversations,
        currentConversationId: conversations.some(
          (item) => item.id === chat.currentConversationId,
        )
          ? chat.currentConversationId
          : null,
        canCreateChat,
        chatMessage,
        onRetryChats: () => {
          setNotice(null); setChatRevision(value => value + 1);
          if (userId) void loadConversations(userId, orgId).then(rows => { if (scopeRef.current === key) chat.setConversations(rows); }).catch(() => { if (scopeRef.current === key) setNotice({ key, message: 'No se pudieron actualizar las conversaciones. Reintenta en unos momentos.' }); });
        },
        browserOpen,
        onNavigate: navigate,
        onBack: () => {
          setBrowserOpen(false);
          onExit();
        },
        onNewChat,
        onOpenChat: (id) => {
          void openChat(id);
        },
        onBrowserNewChat: async () => {
          if (!await prepareChat()) throw new Error('No se pudo preparar un chat editable de este proyecto.');
        },
        onBrowserOpenChat: (id) => openChat(id, true),
        onOpenBrowser: () => {
          void openBrowser().catch(() =>
            setNotice({ key, message: "No se pudo abrir el navegador." }),
          );
        },
      }
    : undefined;
  const canShowChat =
    !!chatFolder &&
    (conversations.some((item) => item.id === chat.currentConversationId) ||
      (!chat.currentConversationId &&
        folder.currentFolderId === chatFolder.id &&
        canCreateChat));
  return {
    navigation,
    onProjectReady,
    onOpenWeb,
    canShowChat,
    key,
    exit: onExit,
  };
}
