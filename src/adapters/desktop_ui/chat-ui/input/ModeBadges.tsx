import type { ChatUIController } from '../useChatUIController';

const OPTIMIZER_TARGETS = ['chatgpt', 'claude', 'gemini'] as const;

export function ModeBadges({ controller }: { controller: ChatUIController }) {
  const { modes, toolModals } = controller.state;
  const liveApi = controller.runtime.liveApi;

  if (!modes.imageGen && !modes.promptOptimizer && !toolModals.activeTool && !liveApi.isLiveActive && !liveApi.isLiveConnecting) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {modes.imageGen && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-purple-500/10 text-purple-500 rounded-full border border-purple-500/20">
          Modo Imagen
          <button onClick={() => modes.setImageGen(false)} className="ml-1 hover:opacity-70">x</button>
        </span>
      )}
      {modes.promptOptimizer && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-full border border-accent/20">
            Mejorar Prompt
            <button onClick={() => modes.setPromptOptimizer(false)} className="ml-1 hover:opacity-70">x</button>
          </span>
          <div className="flex gap-1">
            {OPTIMIZER_TARGETS.map((target) => (
              <button
                key={target}
                onClick={() => modes.setOptimizerTarget(target)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${modes.optimizerTarget === target ? 'bg-accent text-white shadow-sm' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}
              >
                {target === 'chatgpt' ? 'ChatGPT' : target === 'claude' ? 'Claude' : 'Gemini'}
              </button>
            ))}
          </div>
        </div>
      )}
      {toolModals.activeTool && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-full border border-accent/20">
          <span>{toolModals.activeTool.icon}</span>
          {toolModals.activeTool.name}
          <button onClick={() => toolModals.setActiveTool(null)} className="ml-1 hover:opacity-70">x</button>
        </span>
      )}
      {(liveApi.isLiveActive || liveApi.isLiveConnecting) && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-full border border-accent/20">
          <div className={`w-2 h-2 rounded-full ${liveApi.isLiveActive ? 'bg-accent animate-pulse' : 'bg-yellow-500 animate-spin'}`} />
          {liveApi.isLiveConnecting ? 'Conectando...' : 'En Vivo'}
          <button onClick={liveApi.stopLiveConversation} className="ml-1 hover:opacity-70">x</button>
        </span>
      )}
    </div>
  );
}
