export type CollectedFile = {
  name: string;
  fullPath: string;
  relativePath: string;
};

export type MovedFile = {
  name: string;
  from: string;
  to: string;
};

export type FileOperationManifest = {
  id: string;
  createdAt: string;
  operation: 'organize_files' | 'batch_move_files';
  sourcePath: string;
  destinationPath?: string;
  options: Record<string, any>;
  moved: MovedFile[];
  undoneAt?: string;
};

export type ProgressCallback = (message: string) => void;
