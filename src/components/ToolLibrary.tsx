/**
 * Tool Library - Shows user's saved prompts/tools
 */

import { useState, useEffect } from 'react';
import { UserTool, getUserTools, deleteUserTool } from '../services/tools-service';

interface ToolLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTool: (tool: UserTool) => void;
  onEditTool: (tool: UserTool) => void;
}

export function ToolLibrary({ isOpen, onClose, onUseTool, onEditTool }: ToolLibraryProps) {
  const [tools, setTools] = useState<UserTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadTools();
  }, [isOpen]);

  const loadTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserTools();
      setTools(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar herramientas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserTool(id);
      setTools(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      console.error('Error deleting tool:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#1a1f2e] rounded-2xl w-[90%] max-w-[550px] max-h-[80vh] flex flex-col border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Mis Herramientas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl">x</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
          )}

          {!loading && !error && tools.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-gray-400 text-sm">No tienes herramientas guardadas aún.</p>
              <p className="text-gray-500 text-xs mt-1">Usa "Crear Prompt" en el menú + para crear una.</p>
            </div>
          )}

          {tools.map(tool => (
            <div
              key={tool.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group"
            >
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
                  onClick={() => onUseTool(tool)}
                  className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors font-medium"
                >
                  Usar
                </button>
                <button
                  onClick={() => onEditTool(tool)}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(tool.id)}
                  className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ToolLibrary;
