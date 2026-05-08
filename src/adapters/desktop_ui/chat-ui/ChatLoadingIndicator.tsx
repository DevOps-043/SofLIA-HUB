import { TOOL_DISPLAY_NAMES } from './tool-display-names';

type ActiveToolCall = {
  name: string;
  args?: {
    path?: string;
    command?: string;
  };
};

export function ChatLoadingIndicator({ activeToolCall }: { activeToolCall?: ActiveToolCall | null }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden">
        <img src="./assets/lia-avatar.png" alt="SOFLIA" className="w-full h-full object-cover" />
      </div>
      <div className="flex flex-col gap-2 pt-2">
        {activeToolCall ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl animate-in fade-in duration-300">
            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-accent">
              {TOOL_DISPLAY_NAMES[activeToolCall.name] || activeToolCall.name}
            </span>
            {activeToolCall.args?.path && (
              <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{activeToolCall.args.path}</span>
            )}
            {activeToolCall.args?.command && (
              <span className="text-[10px] text-gray-400 truncate max-w-[200px] font-mono">{activeToolCall.args.command}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.2s]" />
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    </div>
  );
}
