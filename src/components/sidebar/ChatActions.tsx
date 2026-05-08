import type { ChatItemProps } from './ChatItem';
import { ChatContextMenu } from './ChatContextMenu';
import { EditIcon, MoreIcon } from './ChatIcons';

export function ChatActions({ props }: { props: ChatItemProps }) {
  const menuVisible = props.canRename || props.canMove || props.canDelete;
  return (
    <div className={`flex items-center gap-0.5 opacity-0 ${props.compact ? 'group-hover/chat:opacity-100' : 'group-hover:opacity-100'} transition-opacity`}>
      {props.canRename && <button onClick={(e) => { e.stopPropagation(); props.onStartRename(); }} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors" title="Renombrar"><EditIcon /></button>}
      {menuVisible && (
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); props.onToggleMenu(); }} className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 transition-colors ${props.isMenuOpen ? 'text-accent' : 'text-gray-400 dark:text-gray-500'}`} title="Mas opciones"><MoreIcon /></button>
          {props.isMenuOpen && <ChatContextMenu canRename={props.canRename} canMove={props.canMove} canDelete={props.canDelete} onRename={props.onStartRename} onMove={props.onMove} onDelete={props.onDelete} onClose={props.onToggleMenu} />}
        </div>
      )}
    </div>
  );
}
