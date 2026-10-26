import { z } from 'zod';

const uuid = z.string().uuid();
export const projectCloudProvider = z.enum(['google_drive', 'onedrive']);
export type ProjectCloudProvider = z.infer<typeof projectCloudProvider>;
const target = z.object({ workspaceId: uuid, projectId: uuid }).strict();
export const projectCreationInputs = {
  resolveOrganization: z.object({ organizationId: uuid }).strict(),
  selectFolder: z.object({}).strict(),
  cloudAccounts: z.object({}).strict(),
  authorizeCloud: z.object({ provider: projectCloudProvider }).strict(),
  cloudFolders: z.object({ provider: projectCloudProvider, selectionId: uuid.optional(), cursor: uuid.optional() }).strict(),
  createCloudFolder: z.object({ provider: projectCloudProvider, selectionId: uuid, operationId: uuid, name: z.string().trim().min(1).max(100).refine(value => value !== '.' && value === projectDirectoryName(value), 'Elige un nombre de carpeta válido.') }).strict(),
  createConfigured: z.object({
    operationId: uuid,
    organizationId: uuid,
    name: z.string().trim().min(1).max(255),
    storage: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('local'), parentSelectionId: uuid }).strict(),
      z.object({ mode: projectCloudProvider, parentSelectionId: uuid }).strict(),
    ]),
    additionalSelectionIds: z.array(uuid).max(10),
  }).strict(),
  getLocation: target,
  locationFiles: target,
  uploadLocationFiles: target.extend({ operationId: uuid }),
  cancelLocationUpload: z.object({ operationId: uuid }).strict(),
};
export type ProjectCreationInputs = { [K in keyof typeof projectCreationInputs]: z.input<(typeof projectCreationInputs)[K]> };
export interface ProjectOrganization { workspaceId: string; name: string; role: string }
export interface ProjectFolderSelection { selectionId: string; path: string; name: string }
export interface ProjectCloudAccount { provider: ProjectCloudProvider; connected: boolean; email?: string; needsAuthorization: boolean }
export interface ProjectCloudSelection { selectionId: string; name: string; accountEmail: string; provider: ProjectCloudProvider }
export interface ProjectCloudFolderListing extends ProjectCloudSelection {
  breadcrumbs: Array<{ selectionId: string; name: string }>;
  folders: Array<{ selectionId: string; name: string }>;
  nextCursor?: string;
}
export interface ProjectCloudLocation { provider: ProjectCloudProvider; accountEmail: string; folderId: string; driveId?: string; name: string; webUrl?: string }
export interface ProjectLocation {
  /** cloud sólo se admite al leer configuraciones anteriores sin proveedor. */
  mode: 'local' | 'cloud' | ProjectCloudProvider;
  rootPath?: string;
  additionalFolders: string[];
  cloud?: ProjectCloudLocation;
}
export interface ProjectLocationFiles { location: ProjectLocation | null; files: Array<{ id: string; name: string; size: number; webUrl?: string }>; partial: boolean }
export function projectDirectoryName(name: string): string {
  const printable = [...name].map(character => character.charCodeAt(0) < 32 ? '-' : character).join('');
  const cleaned = printable.trim().replace(/[<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '').slice(0, 100).replace(/[. ]+$/g, '');
  return !cleaned || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned) || cleaned === '..' ? `Proyecto-${cleaned || 'nuevo'}` : cleaned;
}
