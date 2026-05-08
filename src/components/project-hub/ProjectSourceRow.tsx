import type { WorkspaceSource } from '../../services/workspace-sources';
import { formatFileSize, sourceTypeIcon } from './formatters';

interface ProjectSourceRowProps {
  source: WorkspaceSource;
  onOpenSource: (source: WorkspaceSource) => void;
  onRemoveSource: (sourceId: string) => void;
}

export function ProjectSourceRow({ source, onOpenSource, onRemoveSource }: ProjectSourceRowProps) {
  return (
    <div className="group flex items-center justify-between p-3 hover:bg-primary/5 dark:hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/5">
      <div className="flex items-center gap-4 flex-1 min-w-0" onClick={() => onOpenSource(source)}>
        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent ring-1 ring-accent/20">
          {sourceTypeIcon(source.source_type)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-primary dark:text-gray-100 truncate">{source.file_name}</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
            {source.source_type}{source.file_size ? ` - ${formatFileSize(source.file_size)}` : ''}
          </p>
        </div>
      </div>
      <button
        onClick={() => onRemoveSource(source.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-danger transition-all ml-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
