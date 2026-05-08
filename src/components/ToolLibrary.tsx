import { useEffect, useState } from 'react';
import { deleteUserTool, getUserTools, type UserTool } from '../services/tools-service';
import { ToolLibraryItem } from './tool-library/ToolLibraryItem';
import {
  ToolLibraryEmpty,
  ToolLibraryError,
  ToolLibraryLoading,
} from './tool-library/ToolLibraryStates';
import type { ToolLibraryProps } from './tool-library/types';

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
      setTools(await getUserTools());
    } catch (err: any) {
      setError(err.message || 'Error al cargar herramientas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserTool(id);
      setTools((prev) => prev.filter((tool) => tool.id !== id));
    } catch (err: any) {
      console.error('Error deleting tool:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#1a1f2e] rounded-2xl w-[90%] max-w-[550px] max-h-[80vh] flex flex-col border border-white/10 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Mis Herramientas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl">x</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <ToolLibraryLoading />}
          {error && <ToolLibraryError error={error} />}
          {!loading && !error && tools.length === 0 && <ToolLibraryEmpty />}
          {tools.map((tool) => (
            <ToolLibraryItem
              key={tool.id}
              tool={tool}
              onUse={onUseTool}
              onEdit={onEditTool}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ToolLibrary;
