import { MarkdownRenderer } from '../../../../components/chat/MarkdownRenderer';
import type { ChatMessage } from '../../../../services/chat-service';
import type { ChatUIController } from '../useChatUIController';
import { GeneratedImages } from './GeneratedImages';
import { ModelMessageActions } from './ModelMessageActions';
import { SourceLinks } from './SourceLinks';

export function ModelMessageContent({
  controller,
  message,
}: {
  controller: ChatUIController;
  message: ChatMessage;
}) {
  return (
    <>
      <div className="p-0 bg-transparent border-none shadow-none text-gray-800 dark:text-gray-100 text-[15px] leading-relaxed group/msg-content relative transition-all duration-300">
        <MarkdownRenderer text={message.text} />
      </div>
      <GeneratedImages images={message.images} onZoom={controller.state.images.setZoomed} />
      <SourceLinks sources={message.sources} />
      <ModelMessageActions controller={controller} message={message} />
    </>
  );
}
