import type { ToolLibraryItemProps } from './types';

export function ToolLibraryItem({ tool, onUse, onEdit, onDelete }: ToolLibraryItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group">
      <div className="text-2xl flex-shrink-0 mt-0.5">{tool.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-white truncate">{tool.name}</div>
        {tool.description && (
          <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{tool.description}</div>
        )}
        {tool.category && (
          <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] bg-accent/10 text-accent rounded-full">
            {tool.category}
          </span>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onUse(tool)}
          className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors font-medium"
        >
          Usar
        </button>
        <button
          onClick={() => onEdit(tool)}
          className="px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(tool.id)}
          className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          x
        </button>
      </div>
    </div>
  );
}
