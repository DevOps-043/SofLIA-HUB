import type { ChatUIController } from '../useChatUIController';
import {
  LiveIcon,
  ImageIcon,
  SparklesIcon,
  DocumentIcon,
  ToolsIcon,
  PaperclipIcon
} from '../../../../components/ui/Icons';

type ToolOption = { id: string; label: string; sub: string; active?: boolean };

function getToolIcon(id: string, active: boolean) {
  const size = 13.5;
  const className = active
    ? 'text-accent'
    : 'text-gray-500 dark:text-white/40 group-hover:text-gray-700 dark:group-hover:text-white/80';
  switch (id) {
    case 'live_api':
      return <LiveIcon size={size} className={className} />;
    case 'image_gen':
      return <ImageIcon size={size} className={className} />;
    case 'prompt_opt':
      return <SparklesIcon size={size} className={className} />;
    case 'create_prompt':
      return <DocumentIcon size={size} className={className} />;
    case 'my_tools':
      return <ToolsIcon size={size} className={className} />;
    case 'attach_file':
      return <PaperclipIcon size={size} className={className} />;
    default:
      return <span className={className}>+</span>;
  }
}

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
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
          controller.state.tools.isOpen
            ? 'bg-accent text-white shadow-md'
            : 'bg-white dark:bg-white/[0.04] text-gray-500 hover:text-gray-700 dark:hover:text-white/80 hover:shadow-sm border border-gray-200/60 dark:border-white/[0.06]'
        }`}
        title="Mas opciones"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      {controller.state.tools.isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => controller.state.tools.setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-3 w-64 bg-white/95 dark:bg-[#161B22]/95 border border-gray-200/50 dark:border-white/[0.08] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_48px_rgba(0,0,0,0.5)] overflow-hidden z-50 p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            {options.map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  controller.tools.handleToolSelect(tool.id);
                  controller.state.tools.setOpen(false);
                }}
                className={`w-full text-left flex items-center gap-3 px-2 py-2 rounded-xl transition-all duration-150 group ${
                  tool.active
                    ? 'bg-accent/8 dark:bg-accent/12 border border-accent/10'
                    : 'border border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    tool.active
                      ? 'bg-accent text-white shadow-[0_0_10px_rgba(0,212,179,0.25)]'
                      : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500'
                  }`}
                >
                  {getToolIcon(tool.id, !!tool.active)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[12.5px] font-bold truncate ${tool.active ? 'text-accent' : 'text-gray-900 dark:text-white/90'}`}>
                    {tool.label}
                  </div>
                  <div className="text-[10.5px] font-medium text-gray-400 dark:text-white/30 truncate">
                    {tool.sub}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
