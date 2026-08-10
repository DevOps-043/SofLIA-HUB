import { useRef, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ChatUIController } from '../useChatUIController';
import { TabAttachmentPicker } from './TabAttachmentPicker';
import type { TabContextAttachment } from '../../../../services/integrated-browser-service';
import {
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
    case 'attach_tabs':
      return (
        <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
        </svg>
      );
    case 'image_gen':
      return <ImageIcon size={size} className={className} />;
    case 'prompt_opt':
      return <SparklesIcon size={size} className={className} />;
    case 'create_prompt':
      return <DocumentIcon size={size} className={className} />;
    case 'my_skills':
      return <ToolsIcon size={size} className={className} />;
    case 'attach_file':
      return <PaperclipIcon size={size} className={className} />;
    default:
      return <span className={className}>+</span>;
  }
}

export function ToolMenu({ controller }: { controller: ChatUIController }) {
  const modes = controller.state.modes;
  const compact = controller.props.compact === true;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const [isTabPickerOpen, setIsTabPickerOpen] = useState(false);

  const attachedTabs = controller.state.tabs?.attached ?? [];
  const hasAttachedTabs = attachedTabs.length > 0;

  const options: ToolOption[] = [
    { id: 'attach_tabs', label: 'Añadir pestañas', sub: 'Análisis multi-pestaña', active: hasAttachedTabs },
    { id: 'image_gen', label: 'Generar Imagen', sub: 'Crea imagenes con IA', active: modes.imageGen },
    { id: 'prompt_opt', label: 'Mejorar Prompt', sub: 'Optimiza para otra IA', active: modes.promptOptimizer },
    { id: 'create_prompt', label: 'Crear Skill', sub: 'Guarda para reusar' },
    { id: 'my_skills', label: 'Skills', sub: 'Del sistema y tuyas' },
    { id: 'attach_file', label: 'Adjuntar Archivo', sub: 'Imagenes y documentos' },
  ];

  // Calcula la posicion del menu cuando se abre, anclada al boton.
  useLayoutEffect(() => {
    if (!controller.state.tools.isOpen || !buttonRef.current) {
      setMenuPos(null);
      setIsTabPickerOpen(false);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 12, // 12px de margen sobre el boton
    });
  }, [controller.state.tools.isOpen]);

  const handleClose = useCallback(() => {
    controller.state.tools.setOpen(false);
    setIsTabPickerOpen(false);
  }, [controller.state.tools]);

  const handleToggleTab = (tab: TabContextAttachment) => {
    const current = controller.state.tabs?.attached ?? [];
    const exists = current.some((t) => t.tabId === tab.tabId);
    if (exists) {
      controller.state.tabs?.setAttached(current.filter((t) => t.tabId !== tab.tabId));
    } else {
      controller.state.tabs?.setAttached([...current, tab]);
    }
  };

  return (
    <div className="relative mb-0.5 ml-0.5">
      <button
        ref={buttonRef}
        onClick={() => controller.state.tools.setOpen(!controller.state.tools.isOpen)}
        disabled={!controller.props.canSendMessages}
        className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex items-center justify-center rounded-full transition-all ${
          controller.state.tools.isOpen || hasAttachedTabs
            ? 'bg-accent text-white shadow-md'
            : 'bg-white dark:bg-white/[0.04] text-gray-500 hover:text-gray-700 dark:hover:text-white/80 hover:shadow-sm border border-gray-200/60 dark:border-white/[0.06]'
        }`}
        title="Mas opciones"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
      {controller.state.tools.isOpen && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={handleClose} />
          <div
            className="fixed z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{ left: menuPos.left, bottom: menuPos.bottom }}
          >
            {isTabPickerOpen ? (
              <TabAttachmentPicker
                attachedTabs={attachedTabs}
                onToggleTab={handleToggleTab}
                onClose={handleClose}
              />
            ) : (
              <div className="w-64 bg-white/95 dark:bg-[#161B22]/95 border border-gray-200/50 dark:border-white/[0.08] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_48px_rgba(0,0,0,0.5)] overflow-hidden p-1.5 backdrop-blur-xl">
                {options.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      if (tool.id === 'attach_tabs') {
                        setIsTabPickerOpen(true);
                      } else {
                        controller.tools.handleToolSelect(tool.id);
                        controller.state.tools.setOpen(false);
                      }
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
                    {tool.id === 'attach_tabs' && (
                      <svg className="h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
