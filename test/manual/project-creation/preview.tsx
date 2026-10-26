import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../src/index.css';
import { Sidebar } from '../../../src/components/Sidebar';
import type { SidebarProps } from '../../../src/components/sidebar/types';

const organizationId = '62beba2e-d36c-4b2e-a308-4885c53fd7d7';
const workspaceId = 'a12f1c01-e433-4f89-869a-8066d33654f3';
const projectId = 'f8b9a999-7b76-4c4a-a7ce-3bb6dc7ee7f2';
const ok = (data: unknown) => Promise.resolve({ success: true, data });
let disconnected = false;
window.addEventListener('qa-disconnect', () => { disconnected = true; });
Object.assign(window, { projectHubApi: {
  getStatus: () => ok({ authenticated: true, enabled: true, workspaces: [{ id: workspaceId, name: 'Empresa Demo', role: 'owner' }] }),
  resolveOrganization: () => ok({ workspaceId, name: 'Empresa Demo', role: 'owner' }),
  listProjects: () => ok([]),
  selectFolder: (() => {
    let count = 0;
    return () => { count++; const name = count === 1 ? 'Proyectos' : 'Referencias'; return ok({ selectionId: count === 1 ? projectId : organizationId, name, path: ['C:', 'Usuarios', 'Demo', 'Documentos', name].join(String.fromCharCode(92)) }); };
  })(),
  cloudAccounts: () => ok(disconnected ? [] : [{ provider: 'google_drive', connected: true, email: 'demo@gmail.test', needsAuthorization: false }, { provider: 'onedrive', connected: true, email: 'demo@outlook.test', needsAuthorization: false }]),
  createCloudFolder: () => ok({ provider: 'google_drive', selectionId: organizationId, name: 'Referencias', accountEmail: 'demo@gmail.test' }),
  cloudFolders: ({ provider }: { provider: 'google_drive' | 'onedrive' }) => ok({ provider, selectionId: projectId, name: provider === 'google_drive' ? 'Mi unidad' : 'OneDrive', accountEmail: provider === 'google_drive' ? 'demo@gmail.test' : 'demo@outlook.test', breadcrumbs: [], folders: [] }),
  createConfigured: () => ok({ project_id: projectId, workspace_id: workspaceId, project_name: 'Lanzamiento de producto', project_key: 'LP', completion_percentage: 0 }),
} });
const noop = () => {};
export function Preview() {
  const [notice, setNotice] = useState('');
  const props: SidebarProps = {
    isOpen: true, onToggle: noop, activeView: 'chat', conversations: [], currentConversationId: null, loadingConversations: false,
    onNewChat: noop, onSelectConversation: noop, onDeleteConversation: noop, onTogglePinConversation: noop, renamingChatId: null, onSetRenamingChatId: noop, editingChatTitle: '', onSetEditingChatTitle: noop, onRenameChat: noop, activeMenuChatId: null, onSetActiveMenuChatId: noop, onSetMovingChatId: noop,
    folders: [], expandedFolders: new Set(), currentFolderId: null, onCreateFolderClick: noop, onToggleFolder: noop, onOpenProject: noop, onOpenUnifiedProject: () => setNotice('Proyecto creado en Empresa Demo'), onDeleteFolder: noop, renamingFolderId: null, editingFolderName: '', onSetEditingFolderName: noop, onStartRenameFolder: noop, onFinishRenameFolder: noop, onCancelRenameFolder: noop,
    irisTeams: [], irisProjects: [], irisIssues: {}, expandedTeams: new Set(), expandedProjects: new Set(), onToggleTeam: noop, onToggleProject: noop, onIrisProjectClick: noop, onIrisIssueClick: noop, onRefreshIris: noop,
    displayName: 'Usuario Demo', initials: 'UD', userEmail: 'demo@example.test', avatarUrl: undefined, orgName: 'Empresa Demo', orgLogoUrl: undefined, currentOrgId: organizationId, theme: 'light', onSetTheme: noop, onOpenSettings: noop, onSignOut: noop,
  };
  return <div className="flex h-screen bg-background text-primary"><Sidebar {...props} /><main className="grid min-w-0 flex-1 place-items-center p-8"><div className="max-w-lg text-center"><img src="/assets/Icono.png" className="mx-auto mb-6 h-12 w-12 object-contain" /><h1 className="text-4xl font-semibold tracking-tight">Tu próximo proyecto empieza aquí.</h1><p className="mt-4 text-secondary">Un espacio para tus ideas, conversaciones y archivos.</p>{notice && <p role="status" className="mt-6">{notice}</p>}</div></main></div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
