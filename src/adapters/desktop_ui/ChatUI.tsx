import { useChatBackgroundPresence } from './chat-ui/useChatBackgroundPresence';
import { ChatAvatarProvider } from './chat-ui/ChatAvatar';
import '../../components/avatar/chat-avatar.css';
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

  const activity = controller.runtime.chat.avatarActivity;
  const background = useChatBackgroundPresence(controller.props.messages, props.conversationId, activity?.version);
  const loading = controller.runtime.chat.isLoading;
  const recording = controller.dictation.isRecording;
  const mode = recording ? 'listening' as const
    : controller.preparation.busy || controller.dictation.isTranscribing ? 'thinking' as const
      : loading ? activity?.phase === 'responding' ? 'speaking' as const : activity?.phase === 'executing' ? 'focused' as const : 'thinking' as const : background.active ? 'focused' as const : 'idle' as const;
  const outcome = background.outcome ?? (activity?.expression ? { key: String(activity.version), expression: activity.expression } : undefined);
  const avatarInput = {
    scope: controller.shortcuts.contextKey, mode,
    busy: loading || recording || controller.preparation.busy || background.active,
    permission: Boolean(controller.state.confirmation.modal),
    error: Boolean(controller.dictation.errorMessage || controller.preparation.error),
    draft: controller.state.input.value,
    activityKey: activity ? String(activity.version) : undefined,
    outcome: !loading && !background.active ? outcome : undefined,
  };

  const modalContent = <ChatModals controller={controller} />;

  return (
    <ChatAvatarProvider input={avatarInput} audioFeatures={recording ? controller.dictation.audioFeatures : undefined}><div data-floating-has-messages={props.floating && controller.props.messages.length > 0 ? 'true' : undefined} className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${props.floating ? 'soflia-floating-chat-ui' : 'h-full bg-background dark:bg-background-dark'}`}>
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
      <ChatModalHost floating={props.floating} open={modalOpen}>{modalContent}</ChatModalHost>
    </div></ChatAvatarProvider>
  );
};
