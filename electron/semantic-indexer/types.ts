export interface SearchResult {
  filepath: string;
  filename: string;
  extract: string;
}

export interface IndexerStats {
  totalFiles: number;
  dbSizeBytes: number;
  lastIndexed: Date | null;
}

export interface IndexedDocument {
  filepath: string;
  filename: string;
  content: string;
}
