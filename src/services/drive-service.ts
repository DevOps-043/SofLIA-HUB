/**
 * Google Drive renderer-side service.
 * Typed wrappers for the window.drive bridge exposed via preload.
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: number
  createdTime?: string
  modifiedTime?: string
  webViewLink?: string
  parents?: string[]
}

// ─── Window type augmentation ───────────────────────────────────────

declare global {
  interface Window {
    drive: {
      listFiles: (options?: { query?: string; folderId?: string; maxResults?: number; pageToken?: string }) => Promise<{ success: boolean; files?: DriveFile[]; nextPageToken?: string; error?: string }>
      search: (query: string) => Promise<{ success: boolean; files?: DriveFile[]; error?: string }>
      upload: (localPath: string, options?: { name?: string; folderId?: string; mimeType?: string }) => Promise<{ success: boolean; file?: DriveFile; error?: string }>
      download: (fileId: string, destPath: string) => Promise<{ success: boolean; path?: string; error?: string }>
      createFolder: (name: string, parentId?: string) => Promise<{ success: boolean; folderId?: string; error?: string }>
      deleteFile: (fileId: string) => Promise<{ success: boolean; error?: string }>
      getMetadata: (fileId: string) => Promise<{ success: boolean; file?: DriveFile; error?: string }>
    }
  }
}

// ─── Service functions ──────────────────────────────────────────────

export async function listDriveFiles(options?: { query?: string; folderId?: string; maxResults?: number; pageToken?: string }) {
  return window.drive.listFiles(options)
}

export async function searchDriveFiles(query: string) {
  return window.drive.search(query)
}

export async function uploadToDrive(localPath: string, options?: { name?: string; folderId?: string; mimeType?: string }) {
  return window.drive.upload(localPath, options)
}

export async function downloadFromDrive(fileId: string, destPath: string) {
  return window.drive.download(fileId, destPath)
}

export async function createDriveFolder(name: string, parentId?: string) {
  return window.drive.createFolder(name, parentId)
}

export async function deleteDriveFile(fileId: string) {
  return window.drive.deleteFile(fileId)
}

export async function getDriveFileMetadata(fileId: string) {
  return window.drive.getMetadata(fileId)
}
