/**
 * Workspace Sources — stub service para gestión de archivos adjuntos en carpetas y conversaciones.
 *
 * TODO: Conectar con Supabase storage cuando se implemente el backend de fuentes.
 * Por ahora devuelve datos vacíos para evitar TS2307 en ProjectHub y SourcesPanel.
 */

export interface WorkspaceSource {
  id: string;
  folder_id?: string;
  file_name: string;
  source_type: string;
  file_size?: number;
  url?: string;
  created_at: string;
}

export async function getSourcesForFolder(_folderId: string): Promise<WorkspaceSource[]> {
  return [];
}

export async function getSourcesForConversation(_conversationId: string): Promise<WorkspaceSource[]> {
  return [];
}

export async function addSourceFromDrive(
  _parentId: string,
  _parentType: string,
  _fileId: string,
  _userId: string,
  _orgId: string,
): Promise<WorkspaceSource | null> {
  return null;
}

export async function addSourceFromUpload(
  _parentId: string,
  _parentType: string,
  _file: File,
  _userId: string,
  _orgId: string,
): Promise<WorkspaceSource | null> {
  return null;
}

export async function removeSource(_sourceId: string): Promise<boolean> {
  return true;
}

export async function getDownloadUrl(_source: WorkspaceSource): Promise<string | null> {
  return null;
}
