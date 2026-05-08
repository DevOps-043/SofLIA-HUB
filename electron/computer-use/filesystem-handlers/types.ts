export type ProgressCallback = (message: string) => void;

export interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: string | null;
  sizeBytes: number;
  extension: string | null;
  modified: string | null;
  created: string | null;
}

export interface SearchHit {
  name: string;
  path: string;
  isDirectory: boolean;
}
