import type { WorkspaceApis } from './workspace-api';
import { unavailable } from './workspace-api';

export async function executeDriveTool(toolName: string, args: Record<string, any>, apis: WorkspaceApis): Promise<string | null> {
  const { drive } = apis;
  if (!toolName.startsWith('drive_')) return null;
  if (!drive) return unavailable('Google Drive no conectado.');
  switch (toolName) {
    case 'drive_list_files': {
      const files = args.query ? await drive.search(args.query) : await drive.listFiles({ maxResults: args.max_results || 20 });
      return JSON.stringify(files);
    }
    case 'drive_search':
      return JSON.stringify(await drive.search(args.query));
    case 'drive_download':
      return JSON.stringify(await drive.download(args.file_id, args.destination_path, args.format));
    case 'drive_upload':
      return JSON.stringify(await drive.upload(args.file_path, { name: args.name, folderId: args.folder_id }));
    case 'drive_create_folder':
      return JSON.stringify(await drive.createFolder(args.name, args.parent_id));
    default:
      return null;
  }
}
