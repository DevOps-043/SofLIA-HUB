import type { ProjectCloudLocation, ProjectCloudProvider } from '../../src/shared/project-creation';
import type { ProjectHubOperationAuthorization } from './session-context';

export interface CloudItem { id: string; name: string; folder: boolean; size?: number; driveId?: string; webUrl?: string }
export interface CloudPage { items: CloudItem[]; next?: string }
export interface ProjectCloudPort {
  readonly provider: ProjectCloudProvider;
  readonly email: string;
  assertCurrent(): void;
  assertAccount(): void;
  folder(id?: string, driveId?: string): Promise<CloudItem>;
  children(parent: CloudItem, cursor?: string, foldersOnly?: boolean): Promise<CloudPage>;
  createFolder(parent: CloudItem, name: string, operationId: string): Promise<CloudItem>;
  upload(parent: CloudItem, name: string, mime: string, bytes: Buffer): Promise<CloudItem>;
}
export type ProjectCloudPortFactory = (provider: ProjectCloudProvider, auth: ProjectHubOperationAuthorization) => Promise<ProjectCloudPort>;
export function cloudLocation(port: ProjectCloudPort, item: CloudItem): ProjectCloudLocation {
  return { provider: port.provider, accountEmail: port.email, folderId: item.id, name: item.name, ...(item.driveId ? { driveId: item.driveId } : {}), ...(item.webUrl ? { webUrl: item.webUrl } : {}) };
}
