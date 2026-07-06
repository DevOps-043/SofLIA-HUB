import type { MouseEvent, PointerEvent } from 'react';
import type { ChatItemProps } from './ChatItem';
import { ChatContextMenu } from './ChatContextMenu';
import { EditIcon, MoreIcon } from './ChatIcons';

export function ChatActions({ props }: { props: ChatItemProps }) {
  const menuVisible = props.canRename || props.canMove || props.canDelete;
  const layerClass = props.isMenuOpen ? 'z-[80]' : 'z-10';
  const visibilityClass = props.isMenuOpen
    ? 'pointer-events-auto opacity-100'
    : props.compact
      ? 'group-hover/chat:pointer-events-auto group-hover/chat:opacity-100'
      : 'group-hover:pointer-events-auto group-hover:opacity-100';

  return (
    <>
      {props.isMenuOpen && (
        <div
          className="fixed inset-0 z-[70] cursor-default"
          onPointerDown={stopMenuPropagation}
          onMouseDown={stopMenuPropagation}
          onClick={(event) => {
            event.stopPropagation();
            props.onToggleMenu();
          }}
        />
      )}
      <div
        className={`pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-xl bg-white px-0.5 opacity-0 shadow-[0_4px_14px_rgba(10,37,64,0.10)] transition-opacity dark:bg-[#111820] ${layerClass} ${visibilityClass}`}
        onPointerDown={stopMenuPropagation}
        onMouseDown={stopMenuPropagation}
        onClick={stopMenuPropagation}
      >
        {props.canRename && <button onPointerDown={stopMenuPropagation} onClick={(e) => { e.stopPropagation(); props.onStartRename(); }} className="rounded-xl p-1 text-secondary transition-colors hover:bg-[#0A2540]/10 hover:text-[#0A2540] dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-accent" title="Renombrar"><EditIcon /></button>}
        {menuVisible && (
          <div className="relative">
            <button onPointerDown={stopMenuPropagation} onClick={(e) => { e.stopPropagation(); props.onToggleMenu(); }} className={`rounded-xl p-1 transition-colors hover:bg-[#0A2540]/10 hover:text-[#0A2540] dark:hover:bg-white/10 dark:hover:text-accent ${props.isMenuOpen ? 'text-accent' : 'text-secondary dark:text-white/40'}`} title="Mas opciones"><MoreIcon /></button>
            {props.isMenuOpen && (
              <ChatContextMenu
                canRename={props.canRename}
                canMove={props.canMove}
                canDelete={props.canDelete}
                isPinned={props.isPinned}
                onTogglePin={props.onTogglePin}
                onRename={props.onStartRename}
                onMove={props.onMove}
                onDelete={props.onDelete}
                onClose={props.onToggleMenu}
              />
            )}
          </div>
        )}
        </div>
    </>
  );
}

function stopMenuPropagation(event: MouseEvent<HTMLElement> | PointerEvent<HTMLElement>): void {
  event.stopPropagation();
}
