import { useEffect, useRef, useState } from 'react';

import type { DriveFile } from '../services/drive-service';
import {
  type WorkspaceSource,
  addSourceFromDrive,
  addSourceFromUpload,
  getDownloadUrl,
  getSourcesForConversation,
  getSourcesForFolder,
  removeSource,
} from '../services/workspace-sources';
import { AddSourceMenu } from './sources-panel/AddSourceMenu';
import { DriveFilePicker } from './sources-panel/DriveFilePicker';
import { SourcesList } from './sources-panel/SourcesList';
import type { SourcesPanelProps } from './sources-panel/types';

export const SourcesPanel = ({ parentId, parentType, userId, orgId, isOpen, onClose }: SourcesPanelProps) => {
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
    if (source) setSources((prev) => [source, ...prev]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const source = await addSourceFromUpload(parentId, parentType, file, userId, orgId);
    if (source) setSources((prev) => [source, ...prev]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async (sourceId: string) => {
    const ok = await removeSource(sourceId);
    if (ok) setSources((prev) => prev.filter((source) => source.id !== sourceId));
  };

  const handleOpen = async (source: WorkspaceSource) => {
    const url = await getDownloadUrl(source);
    if (url) window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="relative bg-white dark:bg-[#1a1b1e]/90 border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300" onClick={(event) => event.stopPropagation()}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none" />
          <button onClick={onClose} className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all group">
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative z-10 px-8 pt-10 pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
              <div>
                <h3 className="text-gray-900 dark:text-white text-lg font-black uppercase tracking-widest leading-none">Fuentes</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-60">Archivos vinculados</p>
              </div>
            </div>
          </div>
          <AddSourceMenu showMenu={showMenu} onToggleMenu={() => setShowMenu((value) => !value)} onOpenDrive={() => setShowDrivePicker(true)} onOpenUpload={() => fileInputRef.current?.click()} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          <SourcesList sources={sources} loading={loading} onOpen={handleOpen} onRemove={handleRemove} />
        </div>
      </div>
      {showDrivePicker && <DriveFilePicker onSelect={handleDriveSelect} onClose={() => setShowDrivePicker(false)} />}
    </>
  );
};
