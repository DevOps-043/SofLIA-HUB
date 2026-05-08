import { useEffect, useState } from 'react';
import { ProjectChatInput } from './project-hub/ProjectChatInput';
import { ProjectChatsTab } from './project-hub/ProjectChatsTab';
import { ProjectHeader } from './project-hub/ProjectHeader';
import { ProjectHubIcon } from './project-hub/ProjectHubIcon';
import { ProjectSourcesTab } from './project-hub/ProjectSourcesTab';
import { ProjectTabs } from './project-hub/ProjectTabs';
import type { ProjectHubProps, ProjectHubTab } from './project-hub/types';
import { useProjectChatInput } from './project-hub/useProjectChatInput';
import { useProjectEditing } from './project-hub/useProjectEditing';
import { useProjectSources } from './project-hub/useProjectSources';

export function ProjectHub({
  folder, chats, onOpenChat, onNewChat, onNewChatWithMessage, onDeleteChat,
  onRenameFolder, onRenameChat, onShareFolder, userId, orgId,
}: ProjectHubProps) {
  const [activeTab, setActiveTab] = useState<ProjectHubTab>('chats');
  const canEditFolder = folder.can_edit !== false;
  const canShareFolder = Boolean(folder.can_share);
  const folderSharedBadgeLabel = canShareFolder ? 'Compartida' : 'Recibida';
  const editing = useProjectEditing({ folder, chats, canShareFolder, onRenameFolder, onRenameChat });
  const chatComposer = useProjectChatInput({ canEditFolder, onNewChat, onNewChatWithMessage });
  const sources = useProjectSources({ folderId: folder.id, userId, orgId });

  useEffect(() => {
    if (activeTab === 'sources' && userId && orgId) void sources.loadSourcesData();
  }, [activeTab, folder.id, orgId, sources.loadSourcesData, userId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-background dark:bg-background-dark overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-2xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center">
        <ProjectHubIcon />
        <ProjectHeader
          canEditFolder={canEditFolder}
          canShareFolder={canShareFolder}
          chatsLength={chats.length}
          editName={editing.editName}
          folder={folder}
          folderSharedBadgeLabel={folderSharedBadgeLabel}
          inputRef={editing.inputRef}
          isEditing={editing.isEditing}
          onSaveName={editing.saveFolderName}
          onSetEditName={editing.setEditName}
          onSetIsEditing={editing.setIsEditing}
          onShareFolder={onShareFolder}
        />
        <ProjectChatInput
          canEditFolder={canEditFolder}
          chatInput={chatComposer.chatInput}
          chatInputRef={chatComposer.chatInputRef}
          folderName={folder.name}
          onSetChatInput={chatComposer.setChatInput}
          onSubmit={chatComposer.submitChatInput}
        />
        <ProjectTabs activeTab={activeTab} onSetActiveTab={setActiveTab} />
        <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'chats' ? (
            <ProjectChatsTab
              chats={chats}
              editingChatTitle={editing.editingChatTitle}
              renamingChatId={editing.renamingChatId}
              onDeleteChat={onDeleteChat}
              onOpenChat={onOpenChat}
              onSaveChatTitle={editing.saveChatTitle}
              onSetEditingChatTitle={editing.setEditingChatTitle}
              onSetRenamingChatId={editing.setRenamingChatId}
              onStartRenamingChat={editing.startRenamingChat}
            />
          ) : (
            <ProjectSourcesTab
              {...sources}
              hasWorkspaceIdentity={Boolean(userId && orgId)}
              onCloseDrivePicker={() => sources.setShowDrivePicker(false)}
              onDriveSearchChange={sources.setDriveSearch}
              onDriveSelect={sources.handleDriveSelect}
              onFileUpload={sources.handleFileUpload}
              onOpenDrivePicker={sources.openDrivePicker}
              onOpenSource={sources.handleOpenSource}
              onRemoveSource={sources.handleRemoveSource}
              onSearchDrive={() => sources.loadDriveFiles(sources.driveSearch.trim() || undefined)}
              onToggleAddMenu={() => sources.setShowAddMenu(!sources.showAddMenu)}
              onUploadClick={sources.triggerUpload}
            />
          )}
        </div>
      </div>
    </div>
  );
}
