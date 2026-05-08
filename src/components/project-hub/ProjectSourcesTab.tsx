import type { ChangeEvent, RefObject } from 'react';
import type { DriveFile } from '../../services/drive-service';
import type { WorkspaceSource } from '../../services/workspace-sources';
import { AddSourceMenu } from './AddSourceMenu';
import { DrivePickerModal } from './DrivePickerModal';
import { ProjectEmptyState } from './ProjectEmptyState';
import { ProjectSourceRow } from './ProjectSourceRow';

interface ProjectSourcesTabProps {
  driveFiles: DriveFile[];
  driveLoading: boolean;
  driveSearch: string;
  fileInputRef: RefObject<HTMLInputElement>;
  hasWorkspaceIdentity: boolean;
  loadingSources: boolean;
  showAddMenu: boolean;
  showDrivePicker: boolean;
  sources: WorkspaceSource[];
  onCloseDrivePicker: () => void;
  onDriveSearchChange: (value: string) => void;
  onDriveSelect: (file: DriveFile) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenDrivePicker: () => void;
  onOpenSource: (source: WorkspaceSource) => void;
  onRemoveSource: (sourceId: string) => void;
  onSearchDrive: () => void;
  onToggleAddMenu: () => void;
  onUploadClick: () => void;
}

export function ProjectSourcesTab(props: ProjectSourcesTabProps) {
  return (
    <div className="w-full">
      {props.hasWorkspaceIdentity && (
        <AddSourceMenu
          fileInputRef={props.fileInputRef}
          isOpen={props.showAddMenu}
          onFileUpload={props.onFileUpload}
          onOpenDrivePicker={props.onOpenDrivePicker}
          onToggle={props.onToggleAddMenu}
          onUploadClick={props.onUploadClick}
        />
      )}

      {props.loadingSources ? (
        <div className="py-20 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : props.sources.length === 0 ? (
        <ProjectEmptyState type="sources" label="Sin fuentes disponibles" />
      ) : (
        <div className="space-y-1">
          {props.sources.map((source) => (
            <ProjectSourceRow
              key={source.id}
              source={source}
              onOpenSource={props.onOpenSource}
              onRemoveSource={props.onRemoveSource}
            />
          ))}
        </div>
      )}

      <DrivePickerModal
        isOpen={props.showDrivePicker}
        driveFiles={props.driveFiles}
        driveLoading={props.driveLoading}
        driveSearch={props.driveSearch}
        onClose={props.onCloseDrivePicker}
        onDriveSearchChange={props.onDriveSearchChange}
        onSearch={props.onSearchDrive}
        onSelect={props.onDriveSelect}
      />
    </div>
  );
}
