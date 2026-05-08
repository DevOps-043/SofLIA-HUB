import { ChatInputArea } from './chat-ui/ChatInputArea';
import { ChatModals } from './chat-ui/ChatModals';
import { MessagesViewport } from './chat-ui/MessagesViewport';
import type { ChatUIProps } from './chat-ui/types';
import { useChatUIController } from './chat-ui/useChatUIController';

export const ChatUI = (props: ChatUIProps) => {
  const controller = useChatUIController(props);

  return (
    <div className="flex-1 flex flex-col h-full bg-background dark:bg-background-dark relative">
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
      <ChatModals controller={controller} />
    </div>
  );
};
