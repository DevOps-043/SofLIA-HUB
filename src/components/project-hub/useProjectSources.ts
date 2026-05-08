import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { listDriveFiles, type DriveFile } from '../../services/drive-service';
import {
  addSourceFromDrive,
  addSourceFromUpload,
  getDownloadUrl,
  getSourcesForFolder,
  removeSource,
  type WorkspaceSource,
} from '../../services/workspace-sources';

interface UseProjectSourcesOptions {
  folderId: string;
  orgId?: string;
  userId?: string;
}

export function useProjectSources({ folderId, orgId, userId }: UseProjectSourcesOptions) {
  const [sources, setSources] = useState<WorkspaceSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSourcesData = useCallback(async () => {
    setLoadingSources(true);
    setSources(await getSourcesForFolder(folderId));
    setLoadingSources(false);
  }, [folderId]);

  const loadDriveFiles = useCallback(async (query?: string) => {
    setDriveLoading(true);
    const result = await listDriveFiles({ query, maxResults: 20 });
    if (result.success && result.files) setDriveFiles(result.files);
    setDriveLoading(false);
  }, []);

  const handleDriveSelect = useCallback(async (file: DriveFile) => {
    if (!userId || !orgId) return;
    setShowDrivePicker(false);
    const source = await addSourceFromDrive(folderId, 'folder', file.id, userId, orgId);
    if (source) setSources((previous) => [source, ...previous]);
  }, [folderId, orgId, userId]);

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId || !orgId) return;
    const source = await addSourceFromUpload(folderId, 'folder', file, userId, orgId);
    if (source) setSources((previous) => [source, ...previous]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [folderId, orgId, userId]);

  const handleRemoveSource = useCallback(async (sourceId: string) => {
    const ok = await removeSource(sourceId);
    if (ok) setSources((previous) => previous.filter((source) => source.id !== sourceId));
  }, []);

  const handleOpenSource = useCallback(async (source: WorkspaceSource) => {
    const url = await getDownloadUrl(source);
    if (url) window.open(url, '_blank');
  }, []);

  function openDrivePicker(): void {
    setShowAddMenu(false);
    setShowDrivePicker(true);
    void loadDriveFiles();
  }

  function triggerUpload(): void {
    setShowAddMenu(false);
    fileInputRef.current?.click();
  }

  return {
    driveFiles, driveLoading, driveSearch, fileInputRef, handleDriveSelect,
    handleFileUpload, handleOpenSource, handleRemoveSource, loadDriveFiles,
    loadSourcesData, loadingSources, openDrivePicker, setDriveSearch,
    setShowDrivePicker, setShowAddMenu, showAddMenu, showDrivePicker,
    sources, triggerUpload,
  };
}
