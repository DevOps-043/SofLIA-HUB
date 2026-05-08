export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

export type DriveExportFormat = 'text' | 'pdf';

export type DriveOperationResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  success: boolean;
  error?: string;
} & Partial<T>;

export type GoogleExportInfo = {
  mimeType: string;
  ext: string;
};
