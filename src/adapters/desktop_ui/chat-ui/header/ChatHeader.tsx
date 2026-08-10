import { ModelSelectorDropdown } from './ModelSelectorDropdown';
import { ShareButton } from './ShareButton';
import { ToolsDropdownButton } from './ToolsDropdownButton';
import type { ChatUIController } from '../useChatUIController';

export function ChatHeader({ controller }: { controller: ChatUIController }) {
  if (controller.props.compact) return null;

  const model = controller.runtime.model;
  const header = controller.state.header;

  return (
    <div
      className={`sticky top-0 z-30 w-full px-4 pt-2.5 pb-1 transition-all duration-300 ${
        header.show ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      style={{ fontFamily: 'var(--font-system-ui)' }}
    >
      <div className="w-full max-w-full rounded-full border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-[#0a0e14]/85 backdrop-blur-xl saturate-[140%] shadow-[0_0.5rem_2rem_rgba(0,0,0,0.08)] dark:shadow-[0_0.5rem_2rem_rgba(0,0,0,0.35)] px-3.5 py-1.5 flex items-center justify-between relative">
        <div className="relative inline-block z-10">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              model.setIsModelSelectorOpen(!model.isModelSelectorOpen);
            }}
            aria-haspopup="menu"
            aria-expanded={model.isModelSelectorOpen}
            aria-label={`Seleccionar modelo. Modelo actual: ${model.currentModel?.name || 'SofLIA'}`}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-sm font-semibold transition-all duration-150 group focus:outline-none ${
              model.isModelSelectorOpen
                ? 'bg-gray-100 dark:bg-white/[0.08] text-[#0A2540] dark:text-white'
                : 'text-[#0A2540] dark:text-white/90 hover:bg-gray-100/70 dark:hover:bg-white/[0.06]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              <span className="text-[13.5px] font-semibold tracking-tight">
                {model.currentModel?.name || 'SofLIA Pro'}
              </span>
            </span>

            <span
              className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[9.5px] font-bold uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-system-label)' }}
            >
              {model.currentThinkingOption?.name || 'Medio'}
            </span>

            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-400 dark:text-white/40 transition-transform duration-200 ${
                model.isModelSelectorOpen ? 'rotate-180 text-accent' : 'group-hover:text-gray-600 dark:group-hover:text-white/70'
              }`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {model.isModelSelectorOpen && <ModelSelectorDropdown model={model} />}
        </div>

        <div className="flex items-center gap-1 z-10">
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



