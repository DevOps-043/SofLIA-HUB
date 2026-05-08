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
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={props.onClose}>
      <div className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
        <button onClick={props.onClose} className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
          <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <DrivePickerHeader />
        <DriveSearchBox search={props.driveSearch} onChange={props.onDriveSearchChange} onSearch={props.onSearch} />
        <div className="relative z-10 px-4 py-2 max-h-72 overflow-y-auto custom-scrollbar mb-6">
          <DriveFileList loading={props.driveLoading} files={props.driveFiles} onSelect={props.onSelect} />
        </div>
      </div>
    </div>
  );
}

function DrivePickerHeader() {
  return (
    <div className="relative z-10 px-8 pt-10 pb-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
        <div>
          <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Google Drive</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Seleccionar archivo</p>
        </div>
      </div>
    </div>
  );
}

function DriveSearchBox(props: { search: string; onChange: (value: string) => void; onSearch: () => void }) {
  return (
    <div className="relative z-10 px-8 pb-2">
      <div className="flex gap-2">
        <input type="text" value={props.search} onChange={(event) => props.onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') props.onSearch(); }} placeholder="Buscar en Drive..." className="flex-1 px-4 py-2.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all" />
        <button onClick={props.onSearch} className="px-4 py-2.5 bg-accent/10 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all">Buscar</button>
      </div>
    </div>
  );
}

function DriveFileList({ loading, files, onSelect }: { loading: boolean; files: DriveFile[]; onSelect: (file: DriveFile) => void }) {
  if (loading) return <div className="py-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>;
  if (files.length === 0) return <div className="py-12 text-center opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">Sin archivos</p></div>;
  return (
    <div className="space-y-1">
      {files.map((file) => (
        <button key={file.id} onClick={() => onSelect(file)} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all">
          <div className="text-accent">{sourceTypeIcon('drive')}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{file.name}</p>
            <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">{file.mimeType?.split('/').pop()}{file.size ? ` - ${formatFileSize(Number(file.size))}` : ''}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
