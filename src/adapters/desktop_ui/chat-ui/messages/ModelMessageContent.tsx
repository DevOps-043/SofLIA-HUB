import { MarkdownRenderer } from '../../../../components/chat/MarkdownRenderer';
import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';
import { GeneratedImages } from './GeneratedImages';
import { ModelMessageActions } from './ModelMessageActions';
import { SourceLinks } from './SourceLinks';
import { backgroundJobId } from '../../../../shared/background-team-display';
import { BackgroundChatResult } from '../../../../components/agents/BackgroundChatResult';

export function ModelMessageContent({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  const jobId = backgroundJobId(message);
  return (
    <>
      <div className={`w-full min-w-0 p-0 bg-transparent border-none shadow-none text-gray-800 dark:text-gray-100 text-[15px] leading-relaxed group/msg-content relative transition-all duration-300 ${controller.props.floating ? 'soflia-floating-response' : ''}`}>
        {!jobId && <MarkdownRenderer text={message.text} />}
        {jobId && <BackgroundChatResult jobId={jobId} messageId={message.id} conversationId={controller.props.conversationId ?? undefined} />}
      </div>
      <GeneratedImages images={message.images} onZoom={controller.state.images.setZoomed} />
      <SourceLinks sources={message.sources} responseText={message.text} />
      <ModelMessageActions controller={controller} message={message} />
    </>
  );
}
