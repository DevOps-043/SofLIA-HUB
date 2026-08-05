import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import { ShareButton } from './ShareButton';
import { ToolsDropdownButton } from './ToolsDropdownButton';
import type { ChatUIController } from '../useChatUIController';

export function ChatHeader({ controller }: { controller: ChatUIController }) {
  if (controller.props.compact) return null;

  const model = controller.runtime.model;
  const header = controller.state.header;

  return (
    <div className={`sticky top-0 z-30 w-full transition-all duration-300 ${header.sticky ? 'bg-background/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 shadow-sm py-3' : 'pt-6 pb-2'} ${header.show ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
      <div className="w-full px-6 flex items-center justify-between shrink-0">
        <div className="relative inline-block">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              model.setIsModelSelectorOpen(!model.isModelSelectorOpen);
            }}
            aria-haspopup="menu"
            aria-expanded={model.isModelSelectorOpen}
            className={`flex items-center gap-2 -ml-2 px-2 py-1 rounded-lg text-lg font-medium text-primary dark:text-white/90 transition-colors group ${
              model.isModelSelectorOpen
                ? 'bg-gray-100 dark:bg-white/[0.06]'
                : 'hover:bg-gray-100 dark:hover:bg-white/[0.05]'
            }`}
          >
            <span>{model.currentModel?.name}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-gray-200/60 dark:bg-white/[0.08] text-secondary text-[11px] font-medium">
              {model.currentThinkingOption?.name || 'Medio'}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform duration-200 ${model.isModelSelectorOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          {model.isModelSelectorOpen && <ModelSelectorDropdown model={model} />}
        </div>
        <div className="flex items-center gap-3">
          <ToolsDropdownButton
            onOpenBrowser={controller.props.onOpenBrowser}
            onOpenMeetings={controller.props.onOpenMeetings}
            onOpenSdo={controller.props.onOpenSdo}
          />
          {controller.props.onShare && <ShareButton onShare={controller.props.onShare} />}
        </div>
      </div>
    </div>
  );
}
