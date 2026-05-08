import type { ChatUIController } from '../useChatUIController';

type ToolOption = { id: string; label: string; sub: string; active?: boolean };

export function ToolMenu({ controller }: { controller: ChatUIController }) {
  const liveApi = controller.runtime.liveApi;
  const modes = controller.state.modes;
  const options: ToolOption[] = [
    { id: 'live_api', label: liveApi.isLiveActive ? 'Detener Conversacion' : 'Conversacion en Vivo', sub: liveApi.isLiveActive ? 'Conectada' : 'Audio en tiempo real', active: liveApi.isLiveActive },
    { id: 'image_gen', label: 'Generar Imagen', sub: 'Crea imagenes con IA', active: modes.imageGen },
    { id: 'prompt_opt', label: 'Mejorar Prompt', sub: 'Optimiza para otra IA', active: modes.promptOptimizer },
    { id: 'create_prompt', label: 'Crear Prompt', sub: 'Guarda para reusar' },
    { id: 'my_tools', label: 'Mis Herramientas', sub: 'Prompts guardados' },
    { id: 'attach_file', label: 'Adjuntar Archivo', sub: 'Imagenes y documentos' },
  ];

  return (
    <div className="relative mb-0.5 ml-0.5">
      <button
        onClick={() => controller.state.tools.setOpen(!controller.state.tools.isOpen)}
        disabled={!controller.props.canSendMessages}
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${controller.state.tools.isOpen ? 'bg-accent text-white shadow-md' : 'bg-white dark:bg-black/20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:shadow-sm border border-gray-200 dark:border-white/5'}`}
        title="Mas opciones"
      >
        +
      </button>
      {controller.state.tools.isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => controller.state.tools.setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-3 w-64 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 p-1.5">
            {options.map((tool) => (
              <button
                key={tool.id}
                onClick={() => controller.tools.handleToolSelect(tool.id)}
                className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors group ${tool.active ? 'bg-accent/10 dark:bg-accent/15' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-xs ${tool.active ? 'text-accent border-accent/40' : 'text-gray-400 border-gray-300 dark:border-white/10'}`}>
                  {tool.active ? '•' : '+'}
                </div>
                <div>
                  <div className={`text-[13px] font-semibold ${tool.active ? 'text-accent' : 'text-gray-700 dark:text-gray-200'}`}>{tool.label}</div>
                  <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{tool.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
