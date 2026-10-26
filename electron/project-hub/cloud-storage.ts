import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import type { CalendarService } from '../calendar-service';
import type { ProjectCloudAccount, ProjectCloudFileListing, ProjectCloudLocation, ProjectCloudProvider, ProjectCreationInputs } from '../../src/shared/project-creation';
import type { ProjectHubOperationAuthorization } from './session-context';
import { cloudLocation, type CloudItem, type ProjectCloudPort, type ProjectCloudPortFactory } from './cloud-types';
import { googleProjectStorage } from './google-project-storage';
import { oneDriveProjectStorage } from './onedrive-project-storage';
import { MicrosoftFilesAuth } from './microsoft-files-auth';
import type { ProjectLocationStore } from './location-store';

interface Selection { owner: string; provider: ProjectCloudProvider; email: string; item: CloudItem; trail: Array<{ selectionId: string; name: string }>; assert: () => void; expires: number }
interface Cursor { selectionId: string; value: string }
export class ProjectCloudStorage {
  private readonly selections = new Map<string, Selection>();
  private readonly cursors = new Map<string, Cursor>();
  private readonly folderOperations = new Set<string>();
  constructor(private readonly port: ProjectCloudPortFactory) {}
  private grant(value: Omit<Selection, 'expires'>) {
    const now = Date.now();
    for (const [key, record] of this.selections) if (record.expires < now || record.owner !== value.owner) this.selections.delete(key);
    if (this.selections.size > 500) { this.selections.clear(); this.cursors.clear(); throw new Error('Vuelve a elegir la carpeta de la nube.'); }
    const id = randomUUID();
    this.selections.set(id, { ...value, expires: now + 15 * 60_000 });
    return id;
  }
  private selection(id: string, provider: ProjectCloudProvider, auth: ProjectHubOperationAuthorization) {
    auth.assertCurrent();
    const record = this.selections.get(id);
    if (!record || record.owner !== auth.userId || record.provider !== provider || record.expires < Date.now()) throw new Error('Vuelve a seleccionar una carpeta de tu cuenta vinculada.');
    record.assert();
    return record;
  }
  async folders(input: ProjectCreationInputs['cloudFolders'], auth: ProjectHubOperationAuthorization, includeFiles = false): Promise<ProjectCloudFileListing> {
    const port = await this.port(input.provider, auth); port.assertCurrent();
    let id = input.selectionId;
    if (!id) {
      const root = await port.folder(undefined, undefined, includeFiles); port.assertCurrent();
      id = this.grant({ owner: auth.userId, provider: input.provider, email: port.email, item: { ...root, name: input.provider === 'google_drive' ? 'Mi unidad' : 'OneDrive' }, trail: [], assert: port.assertAccount });
    }
    const selected = this.selection(id, input.provider, auth);
    if (selected.email !== port.email) throw new Error('La cuenta de almacenamiento cambió.');
    const cursor = input.cursor ? this.cursors.get(input.cursor) : undefined;
    if (input.cursor && (!cursor || cursor.selectionId !== id)) throw new Error('El listado de carpetas cambió.');
    if (!selected.item.folder) throw new Error('Selecciona una carpeta para explorar Drive.');
    const current = await port.folder(selected.item.id, selected.item.driveId, includeFiles);
    const page = await port.children(current, cursor?.value, !includeFiles); port.assertCurrent();
    const trail = [...selected.trail, { selectionId: id, name: selected.item.name }];
    const folders = page.items.filter(item => item.folder).map(item => ({ selectionId: this.grant({ owner: auth.userId, provider: input.provider, email: port.email, item, trail, assert: port.assertAccount }), name: item.name }));
    const files = includeFiles ? page.items.filter(item => !item.folder).map(item => ({ selectionId: this.grant({ owner: auth.userId, provider: input.provider, email: port.email, item, trail, assert: port.assertAccount }), name: item.name, webUrl: item.webUrl, mimeType: item.mimeType })) : [];
    let nextCursor: string | undefined;
    if (page.next) {
      if (this.cursors.size >= 500) this.cursors.clear();
      nextCursor = randomUUID(); this.cursors.set(nextCursor, { selectionId: id, value: page.next });
    }
    return { selectionId: id, provider: input.provider, accountEmail: port.email, name: selected.item.name, breadcrumbs: trail, folders, files, nextCursor };
  }
  async selectedFile(selectionId: string, auth: ProjectHubOperationAuthorization) {
    const selected = this.selection(selectionId, 'google_drive', auth);
    const port = await this.port('google_drive', auth); port.assertCurrent();
    if (selected.email !== port.email || selected.item.folder || !port.file) throw new Error('Vuelve a seleccionar el archivo de tu cuenta vinculada.');
    const file = await port.file(selected.item.id); port.assertCurrent();
    if (file.folder || file.id !== selected.item.id) throw new Error('El archivo seleccionado ya no está disponible.');
    return file;
  }
  async prepare(provider: ProjectCloudProvider, selectionId: string, auth: ProjectHubOperationAuthorization) {
    const record = this.selection(selectionId, provider, auth);
    const port = await this.port(provider, auth); port.assertCurrent();
    if (record.email !== port.email) throw new Error('La cuenta vinculada cambió. Vuelve a elegir la carpeta.');
    const parent = await port.folder(record.item.id, record.item.driveId); port.assertCurrent();
    return { port, parent };
  }
  async createFolder(input: ProjectCreationInputs['createCloudFolder'], auth: ProjectHubOperationAuthorization) {
    const selected = this.selection(input.selectionId, input.provider, auth);
    const prepared = await this.prepare(input.provider, input.selectionId, auth);
    const key = `${auth.userId}/${input.operationId}`;
    if (this.folderOperations.has(key)) throw new Error('Esta creación ya se envió. Actualiza las carpetas antes de repetir.');
    if (this.folderOperations.size >= 1000) throw new Error('Cierra y vuelve a abrir la aplicación antes de crear más carpetas.');
    this.folderOperations.add(key);
    const item = await prepared.port.createFolder(prepared.parent, input.name, input.operationId);
    prepared.port.assertCurrent();
    if (!item.folder || item.name !== input.name) throw new Error('No se pudo comprobar la carpeta creada.');
    return { provider: input.provider, accountEmail: prepared.port.email, name: item.name, selectionId: this.grant({ owner: auth.userId, provider: input.provider, email: prepared.port.email, item, trail: [...selected.trail, { selectionId: input.selectionId, name: selected.item.name }], assert: prepared.port.assertAccount }) };
  }
  async create(prepared: { port: ProjectCloudPort; parent: CloudItem }, name: string, operationId: string): Promise<ProjectCloudLocation> {
    prepared.port.assertCurrent();
    return cloudLocation(prepared.port, await prepared.port.createFolder(prepared.parent, name, operationId));
  }
  async stored(location: ProjectCloudLocation, auth: ProjectHubOperationAuthorization) {
    const port = await this.port(location.provider, auth); port.assertCurrent();
    if (port.email.toLowerCase() !== location.accountEmail.toLowerCase()) throw new Error(`Vincula la cuenta ${location.accountEmail} para abrir este proyecto.`);
    const folder = await port.folder(location.folderId, location.driveId); port.assertCurrent();
    return { port, folder };
  }
}

export function createProjectCloudStorage(calendar: CalendarService | undefined, store: Pick<ProjectLocationStore, 'read' | 'write'>) {
  const microsoft = calendar ? new MicrosoftFilesAuth(calendar, store) : null;
  const storage = new ProjectCloudStorage(async (provider, auth) => {
    if (!calendar) throw new Error('Las conexiones de almacenamiento no están disponibles.');
    return provider === 'google_drive' ? googleProjectStorage(calendar, auth) : oneDriveProjectStorage(microsoft!, auth);
  });
  return {
    storage,
    accounts: async (auth: ProjectHubOperationAuthorization): Promise<ProjectCloudAccount[]> => {
      auth.assertCurrent();
      if (calendar && calendar.userId !== auth.userId) throw new Error('La sesión de las cuentas vinculadas cambió.');
      return Promise.all((['google_drive', 'onedrive'] as const).map(async provider => {
        const connection = calendar?.connections.get(provider === 'google_drive' ? 'google' : 'microsoft');
        const connected = !!connection?.isActive && connection.userId === auth.userId && !!connection.email;
        const needsAuthorization = connected && provider === 'onedrive' ? !await microsoft!.authorized(auth) : false;
        auth.assertCurrent();
        return { provider, connected, ...(connected ? { email: connection!.email } : {}), needsAuthorization };
      }));
    },
    authorize: async (provider: ProjectCloudProvider, auth: ProjectHubOperationAuthorization, parent: BrowserWindow) => {
      if (provider !== 'onedrive' || !microsoft) throw new Error('Vincula tu cuenta desde Ajustes > Conexiones.');
      return microsoft.authorize(auth, parent);
    },
  };
}
