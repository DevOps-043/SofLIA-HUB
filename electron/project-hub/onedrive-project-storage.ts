import { z } from 'zod';
import type { MicrosoftFilesAuth } from './microsoft-files-auth';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { CloudItem, ProjectCloudPort } from './cloud-types';
import { readCloudJson } from './cloud-json';

const graph = 'https://graph.microsoft.com';
const itemSchema = z.object({ id: z.string().min(1).max(512), name: z.string().max(1024), size: z.number().nonnegative().optional(), folder: z.object({}).passthrough().optional(), webUrl: z.string().optional(), parentReference: z.object({ driveId: z.string().min(1).max(512) }).passthrough().optional() });
const select = 'id,name,size,folder,webUrl,parentReference';
const encode = encodeURIComponent;
function item(value: unknown): CloudItem {
  const parsed = itemSchema.parse(value);
  let webUrl: string | undefined;
  if (parsed.webUrl) {
    const url = new URL(parsed.webUrl);
    if (url.protocol === 'https:' && !url.username && !url.password && (url.hostname.endsWith('.sharepoint.com') || url.hostname === 'onedrive.live.com' || url.hostname.endsWith('.1drv.com'))) webUrl = url.href;
  }
  return { id: parsed.id, name: parsed.name, folder: !!parsed.folder, size: parsed.size, driveId: parsed.parentReference?.driveId, ...(webUrl ? { webUrl } : {}) };
}
export async function oneDriveProjectStorage(credentials: MicrosoftFilesAuth, authorization: ProjectHubOperationAuthorization, request: typeof fetch = fetch): Promise<ProjectCloudPort> {
  const connection = await credentials.token(authorization);
  const signal = () => AbortSignal.any([AbortSignal.timeout(30_000), ...(authorization.signal ? [authorization.signal] : [])]);
  const json = async (url: string, init: RequestInit = {}) => {
    connection.assert();
    const parsed = new URL(url, graph);
    if (parsed.origin !== graph || !parsed.pathname.startsWith('/v1.0/') || parsed.username || parsed.password || parsed.hash) throw new Error('Destino de OneDrive inválido.');
    const response = await request(parsed, { ...init, headers: { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' }, signal: signal(), redirect: 'error' });
    connection.assert();
    if (!response.ok) throw new Error(response.status === 403 || response.status === 401 ? 'Vuelve a autorizar el acceso a tus archivos de OneDrive.' : response.status === 409 ? 'Ya existe un archivo o carpeta con ese nombre en OneDrive.' : 'OneDrive no pudo completar la operación.');
    const data = await readCloudJson(response); connection.assert();
    return data;
  };
  const base = (parent: CloudItem) => {
    if (!parent.driveId) throw new Error('No se pudo identificar la unidad de OneDrive.');
    return `/v1.0/drives/${encode(parent.driveId)}/items/${encode(parent.id)}`;
  };
  return {
    provider: 'onedrive', email: connection.email, assertCurrent: connection.assert, assertAccount: connection.assertAccount,
    folder: async (id, driveId) => {
      const folder = item(await json(id && driveId ? `/v1.0/drives/${encode(driveId)}/items/${encode(id)}?$select=${select}` : `/v1.0/me/drive/root?$select=${select}`));
      if (!folder.folder || !folder.driveId) throw new Error('Elige una carpeta disponible en OneDrive.');
      return folder;
    },
    children: async (parent, cursor, foldersOnly = true) => {
      const path = `${base(parent)}/children`;
      if (cursor && new URL(cursor).pathname !== path) throw new Error('El listado de OneDrive cambió.');
      const result = z.object({ value: z.array(z.unknown()).max(200), '@odata.nextLink': z.string().optional() }).parse(await json(cursor ?? `${path}?$select=${select}&$top=100`));
      const items = result.value.map(item);
      return { items: foldersOnly ? items.filter(entry => entry.folder) : items, next: result['@odata.nextLink'] };
    },
    createFolder: async (parent, name) => {
      const created = item(await json(`${base(parent)}/children`, { method: 'POST', body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) }));
      if (!created.folder || created.name !== name || created.driveId !== parent.driveId) throw new Error('No se pudo verificar la carpeta creada en OneDrive.');
      return created;
    },
    upload: async (parent, name, _mime, bytes) => {
      const session = z.object({ uploadUrl: z.string().url() }).parse(await json(`${base(parent)}:/${encode(name)}:/createUploadSession`, { method: 'POST', body: JSON.stringify({ item: { name, '@microsoft.graph.conflictBehavior': 'fail' } }) }));
      const url = new URL(session.uploadUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname.endsWith('.1drv.com') || url.hostname.endsWith('.sharepoint.com'))) throw new Error('Destino de subida OneDrive inválido.');
      const chunkSize = 10 * 320 * 1024;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        connection.assert();
        const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
        // La URL de sesión contiene su propia autorización; nunca recibe bearer.
        const response = await request(url, { method: 'PUT', body: new Uint8Array(chunk), headers: { 'Content-Length': String(chunk.length), 'Content-Range': `bytes ${offset}-${offset + chunk.length - 1}/${bytes.length}` }, signal: signal(), redirect: 'error' });
        connection.assert();
        if (!response.ok) throw new Error('No se pudo confirmar la subida a OneDrive.');
        const result = await readCloudJson(response); connection.assert();
        if (offset + chunk.length === bytes.length) {
          if (![200, 201].includes(response.status)) throw new Error('OneDrive no confirmó el archivo completo.');
          const created = item(result);
          if (created.name !== name || created.size !== bytes.length || created.driveId !== parent.driveId || created.folder) throw new Error('No se pudo verificar el archivo guardado en OneDrive.');
          return created;
        }
        if (response.status !== 202 || !z.object({ nextExpectedRanges: z.array(z.string()) }).parse(result).nextExpectedRanges.includes(`${offset + chunk.length}-`)) throw new Error('La sesión de subida de OneDrive cambió.');
      }
      throw new Error('El archivo está vacío.');
    },
  };
}
