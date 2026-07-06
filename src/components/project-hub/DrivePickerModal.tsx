import type { DriveFile } from '../../services/drive-service';
import { formatFileSize, sourceTypeIcon } from './formatters';

interface DrivePickerModalProps {
  isOpen: boolean;
  driveFiles: DriveFile[];
  driveLoading: boolean;
  driveSearch: string;
  onClose: () => void;
  onDriveSearchChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (file: DriveFile) => void;
}

export function DrivePickerModal(props: DrivePickerModalProps) {
  if (!props.isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={props.onClose}>
      <div className="relative bg-white dark:bg-[#161B22] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="absolute top-0 right-0 w-28 h-28 bg-accent/5 blur-[50px] pointer-events-none" />
        <button onClick={props.onClose} className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/5 dark:bg-white/[0.04] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
          <svg className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <DrivePickerHeader />
        <DriveSearchBox search={props.driveSearch} onChange={props.onDriveSearchChange} onSearch={props.onSearch} />
        <div className="relative z-10 px-6 py-2 max-h-64 overflow-y-auto custom-scrollbar mb-4">
          <DriveFileList loading={props.driveLoading} files={props.driveFiles} onSelect={props.onSelect} />
        </div>
      </div>
    </div>
  );
}

function DrivePickerHeader() {
  return (
    <div className="relative z-10 px-6 pt-8 pb-1">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-5 bg-accent rounded-full shadow-[0_0_8px_rgba(0,212,179,0.3)]" />
        <div>
          <h3 className="text-gray-900 dark:text-white text-base font-semibold tracking-wider leading-none">Google Drive</h3>
          <p className="text-[9px] text-secondary/50 dark:text-white/30 tracking-wider mt-1 uppercase">Seleccionar archivo</p>
        </div>
      </div>
    </div>
  );
}

function DriveSearchBox(props: { search: string; onChange: (value: string) => void; onSearch: () => void }) {
  return (
    <div className="relative z-10 px-6 pb-2">
      <div className="flex gap-2">
        <input type="text" value={props.search} onChange={(event) => props.onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') props.onSearch(); }} placeholder="Buscar en Drive..." className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200/50 dark:border-white/[0.05] rounded-lg text-xs font-light text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-accent/30 transition-all" />
        <button onClick={props.onSearch} className="px-3.5 py-2 bg-accent/10 text-accent rounded-lg text-[10px] font-semibold uppercase tracking-wider hover:bg-accent/20 transition-all">Buscar</button>
      </div>
    </div>
  );
}

function DriveFileList({ loading, files, onSelect }: { loading: boolean; files: DriveFile[]; onSelect: (file: DriveFile) => void }) {
  if (loading) return <div className="py-10 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>;
  if (files.length === 0) return <div className="py-10 text-center opacity-25"><p className="text-[10px] font-medium tracking-wider uppercase text-gray-400">Sin archivos</p></div>;
  return (
    <div className="space-y-0.5">
      {files.map((file) => (
        <button key={file.id} onClick={() => onSelect(file)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/[0.04] transition-all">
          <div className="text-accent">{sourceTypeIcon('drive')}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-light text-gray-900 dark:text-white truncate">{file.name}</p>
            <p className="text-[9px] text-secondary/50 dark:text-white/20 tracking-wider uppercase mt-0.5">{file.mimeType?.split('/').pop()}{file.size ? ` - ${formatFileSize(Number(file.size))}` : ''}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
