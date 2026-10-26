import { Readable } from 'node:stream';
import { z } from 'zod';
import type { CalendarService } from '../calendar-service';
import { calendarSession } from '../calendar/session-context';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { CloudItem, ProjectCloudPort } from './cloud-types';

const itemSchema = z.object({ id: z.string().min(1).max(512), name: z.string().max(1024), mimeType: z.string(), size: z.string().optional(), webViewLink: z.string().optional(), capabilities: z.object({ canAddChildren: z.boolean().optional() }).optional(), trashed: z.boolean().optional() });
const fields = 'id,name,mimeType,size,webViewLink,trashed,capabilities(canAddChildren)';
const folderMime = 'application/vnd.google-apps.folder';
const quote = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
function item(value: unknown): CloudItem {
  const parsed = itemSchema.parse(value);
  if (parsed.trashed) throw new Error('La carpeta fue retirada de Drive.');
  return { id: parsed.id, name: parsed.name, folder: parsed.mimeType === folderMime, ...(parsed.size ? { size: Number(parsed.size) } : {}), ...(parsed.webViewLink?.startsWith('https://drive.google.com/') ? { webUrl: parsed.webViewLink } : {}) };
}
export async function googleProjectStorage(calendar: CalendarService, authorization: ProjectHubOperationAuthorization): Promise<ProjectCloudPort> {
  const connection = calendar.connections.get('google');
  if (calendar.userId !== authorization.userId || connection?.userId !== authorization.userId || !connection?.isActive || !connection.email) throw new Error('Vincula tu cuenta de Google en Ajustes > Conexiones.');
  const session = calendarSession(calendar, connection);
  const assert = () => { authorization.assertCurrent(); session(); };
  assert();
  const auth = await calendar.getGoogleAuth(); assert();
  if (!auth) throw new Error('Vuelve a conectar Google Drive.');
  const { google } = await import('googleapis'); assert();
  const drive = google.drive({ version: 'v3', auth });
  const options = { retry: false, timeout: 30_000, ...(authorization.signal ? { signal: authorization.signal } : {}) };
  const folder = async (id = 'root') => {
    assert();
    const response = await drive.files.get({ fileId: id, fields, supportsAllDrives: true }, options); assert();
    const parsed = itemSchema.parse(response.data);
    if (parsed.capabilities?.canAddChildren !== true) throw new Error('Necesitas permiso de escritura sobre la carpeta de Drive.');
    const current = item(parsed);
    if (!current.folder) throw new Error('Elige una carpeta de Google Drive.');
    return current;
  };
  const assertAvailable = async (parent: CloudItem, name: string) => {
    const response = await drive.files.list({ q: `'${quote(parent.id)}' in parents and name = '${quote(name)}' and trashed = false`, fields: 'files(id)', pageSize: 1, supportsAllDrives: true, includeItemsFromAllDrives: true }, options); assert();
    if (response.data.files?.length) throw new Error('Ya existe un archivo o carpeta con ese nombre en Drive.');
  };
  return {
    provider: 'google_drive', email: connection.email, assertCurrent: assert, assertAccount: session, folder,
    children: async (parent, cursor, foldersOnly = true) => {
      assert();
      const response = await drive.files.list({ q: `'${quote(parent.id)}' in parents and trashed = false${foldersOnly ? ` and mimeType = '${folderMime}'` : ''}`, fields: `files(${fields}),nextPageToken`, pageSize: 100, pageToken: cursor, orderBy: 'folder,name', supportsAllDrives: true, includeItemsFromAllDrives: true }, options); assert();
      return { items: (response.data.files ?? []).map(item), next: response.data.nextPageToken ?? undefined };
    },
    createFolder: async (parent, name, operationId) => {
      await assertAvailable(parent, name); assert();
      const response = await drive.files.create({ requestBody: { name, mimeType: folderMime, parents: [parent.id], appProperties: { soflia_operation: operationId } }, fields, supportsAllDrives: true }, options); assert();
      const created = item(response.data);
      if (!created.folder) throw new Error('No se pudo comprobar la carpeta creada en Drive.');
      return created;
    },
    upload: async (parent, name, mime, bytes) => {
      await assertAvailable(parent, name); assert();
      const response = await drive.files.create({ requestBody: { name, parents: [parent.id] }, media: { mimeType: mime, body: Readable.from(bytes) }, fields, supportsAllDrives: true }, options); assert();
      const created = item(response.data);
      if (created.size !== bytes.length || created.name !== name || created.folder) throw new Error('No se pudo verificar el archivo guardado en Drive.');
      return created;
    },
  };
}
