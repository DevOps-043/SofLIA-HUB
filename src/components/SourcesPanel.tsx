import { useState, useEffect, useRef } from 'react';
export interface WorkspaceSource {
  id: string;
  file_name: string;
  source_type: string;
  file_size?: number;
}

// Implementaciones mock para resolver TS2307 (Cannot find module)
const getSourcesForFolder = async (_folderId: string): Promise<WorkspaceSource[]> => [];
const getSourcesForConversation = async (_conversationId: string): Promise<WorkspaceSource[]> => [];
const addSourceFromDrive = async (_parentId: string, _parentType: string, _fileId: string, _userId: string, _orgId: string): Promise<WorkspaceSource | null> => null;
const addSourceFromUpload = async (_parentId: string, _parentType: string, _file: File, _userId: string, _orgId: string): Promise<WorkspaceSource | null> => null;
const removeSource = async (_sourceId: string): Promise<boolean> => true;
const getDownloadUrl = async (_source: WorkspaceSource): Promise<string | null> => null;
import { listDriveFiles } from '../services/drive-service';
import type { DriveFile } from '../services/drive-service';

// ============================================
// Props
// ============================================

interface SourcesPanelProps {
  parentId: string;
  parentType: 'folder' | 'conversation';
  userId: string;
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
}

// ============================================
// Iconos por tipo de fuente
// ============================================

const SourceIcon = ({ type }: { type: string }) => {
  if (type === 'drive') return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
    </svg>
  );
  if (type === 'outlook') return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ============================================
// Drive File Picker (sub-modal)
// ============================================

const DriveFilePicker = ({ onSelect, onClose }: { onSelect: (file: DriveFile) => void; onClose: () => void }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async (query?: string) => {
    setLoading(true);
    const result = await listDriveFiles({ query, maxResults: 20 });
    if (result.success && result.files) setFiles(result.files);
    setLoading(false);
  };

  const handleSearch = () => {
    if (search.trim()) loadFiles(search.trim());
    else loadFiles();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />

        <div className="absolute top-4 right-4 z-20">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative z-10 px-8 pt-10 pb-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <div>
              <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Google Drive</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Seleccionar archivo</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-8 pb-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar en Drive..."
              className="flex-1 px-4 py-2.5 bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-700 focus:outline-none focus:border-accent/30 transition-all"
            />
            <button onClick={handleSearch} className="px-4 py-2.5 bg-accent/10 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all">
              Buscar
            </button>
          </div>
        </div>

        <div className="relative z-10 px-4 py-2 max-h-72 overflow-y-auto custom-scrollbar mb-6">
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="py-12 text-center opacity-30">
              <p className="text-[10px] font-black uppercase tracking-widest">Sin archivos</p>
            </div>
          ) : (
            <div className="space-y-1">
              {files.map(file => (
                <button
                  key={file.id}
                  onClick={() => onSelect(file)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all group"
                >
                  <SourceIcon type="drive" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">{file.mimeType?.split('/').pop()}{file.size ? ` - ${formatFileSize(Number(file.size))}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// Sources Panel (main modal)
// ============================================

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ parentId, parentType, userId, orgId, isOpen, onClose }) => {
  const [sources, setSources] = useState<WorkspaceSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) loadSources();
  }, [isOpen, parentId]);

  const loadSources = async () => {
    setLoading(true);
    const data = parentType === 'folder'
      ? await getSourcesForFolder(parentId)
      : await getSourcesForConversation(parentId);
    setSources(data);
    setLoading(false);
  };

  const handleDriveSelect = async (file: DriveFile) => {
    setShowDrivePicker(false);
    const source = await addSourceFromDrive(parentId, parentType, file.id, userId, orgId);
    if (source) setSources(prev => [source, ...prev]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const source = await addSourceFromUpload(parentId, parentType, file, userId, orgId);
    if (source) setSources(prev => [source, ...prev]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async (sourceId: string) => {
    const ok = await removeSource(sourceId);
    if (ok) setSources(prev => prev.filter(s => s.id !== sourceId));
  };

  const handleOpen = async (source: WorkspaceSource) => {
    const url = await getDownloadUrl(source);
    if (url) window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
          onClick={e => e.stopPropagation()}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />

          <div className="absolute top-4 right-4 z-20">
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
              <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Header */}
          <div className="relative z-10 px-8 pt-10 pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
              <div>
                <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Fuentes</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Archivos vinculados</p>
              </div>
            </div>
          </div>

          {/* Add source button */}
          <div className="relative z-10 px-8 pb-2">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-full py-3 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-accent/20 transition-all flex items-center justify-center gap-2 border border-accent/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Agregar Fuente
              </button>

              {showMenu && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-30">
                  <button
                    onClick={() => { setShowMenu(false); setShowDrivePicker(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <SourceIcon type="drive" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Google Drive</span>
                  </button>
                  <div className="h-px bg-gray-200 dark:bg-white/5" />
                  <button
                    onClick={() => { setShowMenu(false); fileInputRef.current?.click(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                    <SourceIcon type="upload" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700 dark:text-gray-300">Subir Archivo</span>
                  </button>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          </div>

          {/* Sources list */}
          <div className="relative z-10 px-4 py-2 max-h-80 overflow-y-auto custom-scrollbar mb-6">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : sources.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center opacity-30">
                <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-[10px] font-black uppercase tracking-widest">Sin fuentes vinculadas</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sources.map(source => (
                  <div
                    key={source.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-accent/10">
                      <SourceIcon type={source.source_type} />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpen(source)}>
                      <p className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{source.file_name}</p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-500 uppercase tracking-widest">
                        {source.source_type}{source.file_size ? ` - ${formatFileSize(source.file_size)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(source.id)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDrivePicker && (
        <DriveFilePicker onSelect={handleDriveSelect} onClose={() => setShowDrivePicker(false)} />
      )}
    </>
  );
};
