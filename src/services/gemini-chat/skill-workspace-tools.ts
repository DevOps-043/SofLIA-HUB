import { generateImage } from '../image-generation';
import type { ActiveSkillContext } from '../gemini-tools/turn-catalog';

/**
 * Ejecucion de las herramientas de archivo acotadas al workspace.
 *
 * El modelo entrega rutas RELATIVAS; el identificador del workspace lo pone
 * el chat desde la Skill activa, nunca el modelo: asi no puede apuntar a un
 * workspace de otra conversacion aunque conozca su identificador.
 */

/** Respuesta del handler IPC: `{ success, error?, ...datos }`. */
type WorkspaceResponse = Record<string, unknown>;

interface WorkspaceBridge {
  writeImage: (workspaceId: string, fileName: string, base64: string) => Promise<WorkspaceResponse>;
  downloadImage: (workspaceId: string, url: string, fileName: string) => Promise<WorkspaceResponse>;
  listFiles: (workspaceId: string) => Promise<WorkspaceResponse>;
  readFile: (workspaceId: string, path: string) => Promise<WorkspaceResponse>;
  writeFile: (workspaceId: string, path: string, content: string) => Promise<WorkspaceResponse>;
  editFile: (
    workspaceId: string,
    path: string,
    search: string,
    replace: string,
    replaceAll?: boolean,
  ) => Promise<WorkspaceResponse>;
}

function bridge(): WorkspaceBridge | null {
  if (typeof window === 'undefined') return null;
  const scope = window as Window & { skillWorkspace?: WorkspaceBridge };
  return scope.skillWorkspace ?? null;
}

export async function executeSkillWorkspaceTool(
  toolName: string,
  args: Record<string, unknown>,
  activeSkill: ActiveSkillContext | null | undefined,
): Promise<string> {
  const workspaceId = activeSkill?.workspaceId;
  if (!workspaceId) {
    // Puede ocurrir si el workspace se cerro entre la declaracion y la
    // llamada. Se responde como error de herramienta para que el modelo lo
    // explique, en vez de fallar el turno completo.
    return JSON.stringify({
      success: false,
      error: 'No hay un espacio de trabajo activo. Pide al usuario que reabra la presentacion.',
    });
  }

  const api = bridge();
  if (!api) {
    return JSON.stringify({ success: false, error: 'El espacio de trabajo no esta disponible en esta superficie.' });
  }

  const path = String(args.path ?? '').trim();

  switch (toolName) {
    case 'workspace_list_files':
      return normalize(await api.listFiles(workspaceId));

    case 'workspace_read_file':
      if (!path) return missingArgument('path');
      return normalize(await api.readFile(workspaceId, path));

    case 'workspace_write_file': {
      if (!path) return missingArgument('path');
      const content = typeof args.content === 'string' ? args.content : '';
      return normalize(await api.writeFile(workspaceId, path, content));
    }

    case 'workspace_edit_file': {
      if (!path) return missingArgument('path');
      const search = typeof args.search === 'string' ? args.search : '';
      const replace = typeof args.replace === 'string' ? args.replace : '';
      if (!search) return missingArgument('search');
      return normalize(await api.editFile(workspaceId, path, search, replace, Boolean(args.replace_all)));
    }

    case 'workspace_generate_image': {
      const prompt = String(args.prompt ?? '').trim();
      const fileName = String(args.file_name ?? '').trim();
      const artDirection = String(args.art_direction ?? '').trim();
      if (!prompt) return missingArgument('prompt');
      if (!fileName) return missingArgument('file_name');

      // La generacion vive en el renderer, que ya tiene la clave y el modelo
      // de imagen configurados; main solo escribe los bytes resultantes.
      // La direccion de arte va en su propio parametro a proposito: pedirle al
      // modelo que "recuerde" repetir el estilo produce series incoherentes;
      // un hueco que rellenar en cada llamada, no.
      const generada = await generateImage(prompt, artDirection ? { artDirection } : {});
      if (!generada.imageData) {
        return JSON.stringify({ success: false, error: generada.text || 'El modelo no devolvio una imagen.' });
      }
      return normalize(await api.writeImage(workspaceId, fileName, stripDataUrl(generada.imageData)));
    }

    case 'workspace_download_image': {
      const url = String(args.url ?? '').trim();
      const fileName = String(args.file_name ?? '').trim();
      if (!url) return missingArgument('url');
      if (!fileName) return missingArgument('file_name');
      return normalize(await api.downloadImage(workspaceId, url, fileName));
    }

    default:
      return JSON.stringify({ success: false, error: `Herramienta de espacio de trabajo desconocida: ${toolName}` });
  }
}

/** El servicio devuelve base64 puro o un data URL; main espera solo base64. */
function stripDataUrl(value: string): string {
  const separador = value.indexOf(',');
  return value.startsWith('data:') && separador !== -1 ? value.slice(separador + 1) : value;
}

function missingArgument(name: string): string {
  return JSON.stringify({ success: false, error: `Falta el argumento obligatorio "${name}".` });
}

function normalize(result: unknown): string {
  if (result && typeof result === 'object') return JSON.stringify(result);
  return JSON.stringify({ success: true, result });
}
