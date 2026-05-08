import { UserMenu } from './sidebar/UserMenu';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarTopActions } from './sidebar/SidebarTopActions';
import { IrisSection } from './sidebar/IrisSection';
import { FolderSection } from './sidebar/FolderSection';
import { UngroupedChats } from './sidebar/UngroupedChats';
import type { SidebarProps } from './sidebar/types';

export type { SidebarProps } from './sidebar/types';

export function Sidebar(props: SidebarProps) {
  const { isOpen, onToggle, onNewChat, onCreateFolderClick } = props;

  return (
    <aside
      className={`${
        isOpen ? 'w-60' : 'w-14'
      } flex-shrink-0 flex flex-col h-full bg-gray-50 dark:bg-[#202123] text-gray-700 dark:text-white border-r border-gray-200 dark:border-none transition-all duration-300 ease-in-out z-30`}
    >
      <SidebarHeader isOpen={isOpen} onToggle={onToggle} />
      <SidebarTopActions
        isOpen={isOpen}
        onNewChat={onNewChat}
        onCreateFolderClick={onCreateFolderClick}
      />

      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto no-scrollbar">
        <IrisSection props={props} />
        <FolderSection props={props} />
        <UngroupedChats props={props} />
      </nav>

      <UserMenu
        isOpen={isOpen}
        displayName={props.displayName}
        initials={props.initials}
        userEmail={props.userEmail}
        avatarUrl={props.avatarUrl}
        orgLogoUrl={props.orgLogoUrl}
        theme={props.theme}
        onSetTheme={props.onSetTheme}
        onOpenSettings={props.onOpenSettings}
        onSignOut={props.onSignOut}
      />
    </aside>
  );
}
