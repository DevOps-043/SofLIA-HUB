import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { ActiveView, ChatState, FolderState } from './app-types';

interface UseAppViewHandlersOptions {
  activeView: ActiveView;
  chat: ChatState;
  folder: FolderState;
  setActiveView: (view: ActiveView) => void;
  setExternalPrompt: (prompt: string | null) => void;
}

export function useAppViewHandlers(options: UseAppViewHandlersOptions) {
  const { activeView, chat, folder, setActiveView, setExternalPrompt } = options;

  const handleNewChat = useCallback(async () => {
    await chat.handleNewChat();
    folder.setCurrentFolderId(null);
    setActiveView('chat');
  }, [chat, folder]);

  const handleNewChatInProject = useCallback(async (folderId: string) => {
    await chat.handleNewChat(folderId);
    folder.setCurrentFolderId(folderId);
    setActiveView('chat');
  }, [chat, folder]);

  const handleNewChatWithMessage = useCallback(async (folderId: string, message: string) => {
    await chat.handleNewChat(folderId);
    folder.setCurrentFolderId(folderId);
    setExternalPrompt(message);
    setActiveView('chat');
  }, [chat, folder]);

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    if (conversationId === chat.currentConversationId && activeView === 'chat') return;
    await chat.handleSelectConversation(conversationId);
    setActiveView('chat');
  }, [chat, activeView]);

  const handleDeleteConversation = useCallback(async (conversationId: string, event: MouseEvent) => {
    event.stopPropagation();
    await chat.handleDeleteConversation(conversationId);
  }, [chat]);

  const handleDeleteFolder = useCallback(async (folderId: string, event: MouseEvent) => {
    event.stopPropagation();
    await folder.handleDeleteFolder(folderId);
    if (folder.currentFolderId === folderId) {
      folder.setCurrentFolderId(null);
      setActiveView('chat');
    }
  }, [folder]);

  const handleOpenProject = useCallback((folderId: string) => {
    folder.setCurrentFolderId(folderId);
    setActiveView('project');
  }, [folder]);

  const handleIrisProjectClick = useCallback(async (project: { project_name: string; project_key: string; project_status: string; completion_percentage: number }) => {
    await handleNewChat();
    setExternalPrompt(`Dame un resumen del estado del proyecto "${project.project_name}" [${project.project_key}]. Estado: ${project.project_status}, Progreso: ${project.completion_percentage}%.`);
  }, [handleNewChat]);

  const handleIrisIssueClick = useCallback(async (issue: { issue_number: number; title: string; description?: string | null; status?: { name: string } | null }) => {
    await handleNewChat();
    const statusName = issue.status?.name || 'Sin estado';
    setExternalPrompt(`Dame detalles sobre la tarea #${issue.issue_number}: "${issue.title}". Estado: ${statusName}.${issue.description ? ` Descripcion: ${issue.description}` : ''}`);
  }, [handleNewChat]);

  return {
    handleDeleteConversation, handleDeleteFolder, handleIrisIssueClick,
    handleIrisProjectClick, handleNewChat, handleNewChatInProject,
    handleNewChatWithMessage, handleOpenProject, handleSelectConversation,
  };
}
