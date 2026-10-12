export const VIEWER_EXTENSIONS = ['md', 'txt', 'json', 'csv', 'docx', 'xlsx', 'pptx', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'html', 'htm'] as const;
export const VIEWER_LIMITS = { fileBytes: 20_000_000, textChars: 200_000, officeExpandedBytes: 32_000_000, sheets: 8, rows: 500, columns: 50, cells: 10_000, tabs: 12 } as const;
export type ArtifactReference = { kind: 'team'; jobId: string; artifactId: string } | { kind: 'local'; id: string };
export type ViewerFile = { reference: ArtifactReference; name: string; extension: string; bytes: number };
export type ViewerSheet = { name: string; rows: string[][]; truncated: boolean };
export type ArtifactPreview = ViewerFile & { content:
  | { kind: 'markdown' | 'text'; text: string; truncated: boolean }
  | { kind: 'html' | 'document'; text: string; truncated: boolean; url?: string }
  | { kind: 'spreadsheet'; sheets: ViewerSheet[]; truncated: boolean }
  | { kind: 'slides'; slides: string[] }
  | { kind: 'pdf' | 'image'; base64: string; mime: string }
};
export type ViewerReply<T> = { success: true; data: T } | { success: false; error: string };
export interface ArtifactViewerBridge {
  preview(reference: ArtifactReference): Promise<ViewerReply<ArtifactPreview>>;
  pick(): Promise<ViewerReply<ViewerFile | null>>;
  openExternal(reference: ArtifactReference): Promise<ViewerReply<null>>;
  saveCopy(reference: ArtifactReference): Promise<ViewerReply<boolean>>;
}
