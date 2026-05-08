import type React from 'react';
import type { DriveFile } from '../../services/drive-service';
import type { WorkspaceSource } from '../../services/workspace-sources';
import { AddSourceMenu } from './AddSourceMenu';
import { DrivePickerModal } from './DrivePickerModal';
import { formatFileSize, sourceTypeIcon } from './formatters';

interface ProjectSourcesPanelProps {
  driveFiles: DriveFile[];
  driveLoading: boolean;
  driveSearch: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isAddMenuOpen: boolean;
  isDrivePickerOpen: boolean;
  loadingSources: boolean;
  orgId?: string;
  sources: WorkspaceSource[];
  userId?: string;
  onDriveSearchChange: (value: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenDrivePicker: () => void;
  onOpenSource: (source: WorkspaceSource) => void;
  onRemoveSource: (sourceId: string) => void;
  onSearchDrive: () => void;
  onSelectDriveFile: (file: DriveFile) => void;
  onSetDrivePickerOpen: (open: boolean) => void;
  onToggleAddMenu: () => void;
  onUploadClick: () => void;
}

export function ProjectSourcesPanel(props: ProjectSourcesPanelProps) {
  return (
    <div className="w-full">
      {props.userId && props.orgId && (
        <AddSourceMenu fileInputRef={props.fileInputRef} isOpen={props.isAddMenuOpen} onFileUpload={props.onFileUpload} onOpenDrivePicker={props.onOpenDrivePicker} onToggle={props.onToggleAddMenu} onUploadClick={props.onUploadClick} />
      )}
      {props.loadingSources ? (
        <div className="py-20 flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : props.sources.length === 0 ? (
        <EmptySourcesState />
      ) : (
        <div className="space-y-1">
          {props.sources.map((source) => (
            <div key={source.id} className="group flex items-center justify-between p-3 hover:bg-primary/5 dark:hover:bg-white/[0.03] rounded-2xl cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/5">
              <div className="flex items-center gap-4 flex-1 min-w-0" onClick={() => props.onOpenSource(source)}>
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent ring-1 ring-accent/20">{sourceTypeIcon(source.source_type)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-primary dark:text-gray-100 truncate">{source.file_name}</h3>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{source.source_type}{source.file_size ? ` - ${formatFileSize(source.file_size)}` : ''}</p>
                </div>
              </div>
              <button onClick={() => props.onRemoveSource(source.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white dark:hover:bg-white/10 text-gray-400 hover:text-danger transition-all ml-2">Quitar</button>
            </div>
          ))}
        </div>
      )}
      <DrivePickerModal isOpen={props.isDrivePickerOpen} driveFiles={props.driveFiles} driveLoading={props.driveLoading} driveSearch={props.driveSearch} onClose={() => props.onSetDrivePickerOpen(false)} onDriveSearchChange={props.onDriveSearchChange} onSearch={props.onSearchDrive} onSelect={props.onSelectDriveFile} />
    </div>
  );
}

function EmptySourcesState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-[10px] font-black uppercase tracking-widest">Sin fuentes disponibles</p>
    </div>
  );
}
