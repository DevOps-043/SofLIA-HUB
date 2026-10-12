import { ChatInputArea } from './chat-ui/ChatInputArea';
import { ChatModals } from './chat-ui/ChatModals';
import { MessagesViewport } from './chat-ui/MessagesViewport';
import type { ChatUIProps } from './chat-ui/types';
import { useChatUIController } from './chat-ui/useChatUIController';

export const ChatUI = (props: ChatUIProps) => {
  const controller = useChatUIController(props);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background dark:bg-background-dark">
      <MessagesViewport controller={controller} />
      <ChatInputArea controller={controller} />
      <input
        ref={controller.refs.fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.csv,.json,.md"
        multiple
        className="hidden"
        disabled={!controller.props.canSendMessages}
        onChange={controller.files.handleImageUpload}
      />
      <ChatModals controller={controller} />
    </div>
  );
};
