import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import { ShareButton } from './ShareButton';
import type { ChatUIController } from '../useChatUIController';

export function ChatHeader({ controller }: { controller: ChatUIController }) {
  const model = controller.runtime.model;
  const header = controller.state.header;

  return (
    <div className={`sticky top-0 z-30 w-full transition-all duration-300 ${header.sticky ? 'bg-background/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 shadow-sm py-3' : 'pt-6 pb-2'} ${header.show ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
      <div className="w-full px-6 flex items-center justify-between shrink-0">
        <div className="relative inline-block">
          <button
            onClick={(event) => {
              event.stopPropagation();
              model.setIsModelSelectorOpen(!model.isModelSelectorOpen);
            }}
            className="flex items-center gap-2 text-lg font-medium text-primary dark:text-white/90 hover:text-accent transition-colors group"
          >
            <span>{model.currentModel?.name}</span>
            <span className="text-secondary text-sm font-normal opacity-60 group-hover:opacity-100 transition-opacity">
              {model.currentThinkingOption?.name || 'Rapido'}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-gray-400 transition-transform duration-200 ${model.isModelSelectorOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          {model.isModelSelectorOpen && <ModelSelectorDropdown model={model} />}
        </div>
        <div className="flex items-center gap-3">
          {controller.props.onShare && <ShareButton onShare={controller.props.onShare} />}
        </div>
      </div>
    </div>
  );
}
