import { ChatInputArea } from './chat-ui/ChatInputArea';
import { ChatModals } from './chat-ui/ChatModals';
import { MessagesViewport } from './chat-ui/MessagesViewport';
import type { ChatUIProps } from './chat-ui/types';
import { useChatUIController } from './chat-ui/useChatUIController';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

function ChatModalHost({ children, floating, open }: { children: ReactNode; floating?: boolean; open: boolean }) {
  return floating ? createPortal(<div data-soflia-floating="true" data-native-browser-overlay={open ? 'true' : undefined}>{children}</div>, document.body) : children;
}

export const ChatUI = (props: ChatUIProps) => {
  const controller = useChatUIController(props);
  const modalOpen = !!controller.state.confirmation.modal || controller.state.skillModals.editorOpen || controller.state.skillModals.libraryOpen || !!controller.state.images.zoomed;

  return (
    <div data-floating-has-messages={props.floating && controller.props.messages.length > 0 ? 'true' : undefined} className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${props.floating ? 'soflia-floating-chat-ui' : 'h-full bg-background dark:bg-background-dark'}`}>
      <MessagesViewport controller={controller} />
      <ChatInputArea controller={controller} />
      <input
        ref={controller.refs.fileInputRef}
        type="file"
        accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.csv,.json,.md"
        multiple
        className="hidden"
        disabled={!controller.props.canSendMessages}
        onChange={controller.files.handleImageUpload}
      />
      <ChatModalHost floating={props.floating} open={modalOpen}><ChatModals controller={controller} /></ChatModalHost>
    </div>
  );
};
