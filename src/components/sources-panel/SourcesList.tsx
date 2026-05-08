import type { WorkspaceSource } from '../../services/workspace-sources';
import { SourceIcon } from './SourceIcon';
import { formatFileSize } from './format';

export function SourcesList({
  sources,
  loading,
  onOpen,
  onRemove,
}: {
  sources: WorkspaceSource[];
  loading: boolean;
  onOpen: (source: WorkspaceSource) => void;
  onRemove: (sourceId: string) => void;
}) {
  if (loading) {
    return <div className="relative z-10 px-4 py-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>;
  }

  if (sources.length === 0) {
    return (
      <div className="relative z-10 px-4 py-12 flex flex-col items-center justify-center opacity-30">
        <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-[10px] font-black uppercase tracking-widest">Sin fuentes vinculadas</p>
      </div>
    );
  }

  return (
    <div className="relative z-10 px-4 py-2 max-h-80 overflow-y-auto custom-scrollbar mb-6">
      <div className="space-y-1">
        {sources.map((source) => (
          <div key={source.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all group">
            <div className="p-2 rounded-lg bg-accent/10">
              <SourceIcon type={source.source_type} />
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(source)}>
              <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{source.file_name}</p>
              <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">
                {source.source_type}{source.file_size ? ` - ${formatFileSize(source.file_size)}` : ''}
              </p>
            </div>
            <button onClick={() => onRemove(source.id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
