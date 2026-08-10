import { useCallback, useEffect, useRef, useState } from 'react';
import {
  presentationApi,
  workspaceApi,
  type WorkspaceFile,
  type WorkspaceProgressEvent,
  type WorkspaceRecord,
  type WorkspaceState,
} from '../../services/skills/workspace-bridge';
import { fileKind, isTextFile } from './file-kind';

/**
 * Estado del panel de trabajo de una presentacion.
 *
 * El panel se alimenta de los eventos de progreso que emite main: no
 * consulta el disco en bucle, de modo que la escritura se ve en cuanto
 * ocurre y el chat sigue utilizable mientras tanto.
 */

export interface PresentationWorkspaceState {
  workspace: WorkspaceRecord | null;
  files: WorkspaceFile[];
  selectedPath: string | null;
  selectedContent: string;
  /** URL local de la imagen seleccionada, si lo es. */
  selectedImageUrl: string | null;
  /** Archivo que main esta escribiendo ahora mismo, si hay alguno. */
  writingPath: string | null;
  /** Errores por archivo, para no perderlos cuando el turno continua. */
  errors: Record<string, string>;
  ready: boolean;
  loading: boolean;
}

/**
 * El panel se monta con `key={workspaceId}`, de modo que cambiar de
 * presentacion remonta el hook con estado limpio. Por eso aqui no hace falta
 * resetear nada al cambiar el identificador.
 */
export function usePresentationWorkspace(workspaceId: string | null) {
  const [state, setState] = useState<PresentationWorkspaceState>(initialState());
  // La seleccion manual del usuario gana sobre la automatica: si eligio un
  // archivo, el progreso no debe robarle el foco a otro.
  const manualSelection = useRef(false);
  // Contador de recargas: el progreso no vuelve a leer el disco por su cuenta,
  // solo pide una relectura y el efecto de abajo la ejecuta.
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const api = workspaceApi();
    // Sin puente o sin workspace el estado inicial ya es el correcto.
    if (!api || !workspaceId) return undefined;

    let cancelled = false;
    void api.getState(workspaceId).then((response) => {
      if (cancelled) return;
      if (!response.success || !response.state) {
        setState((current) => ({ ...current, loading: false }));
        return;
      }
      applyState(setState, response.state);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadToken, workspaceId]);

  // Progreso en vivo. El evento trae el archivo afectado, asi que basta con
  // refrescar el listado y marcar el archivo en curso.
  useEffect(() => {
    const api = workspaceApi();
    if (!api || !workspaceId) return undefined;

    return api.onProgress((event: WorkspaceProgressEvent) => {
      if (event.workspaceId !== workspaceId) return;

      setState((current) => {
        if (event.status === 'en_curso') {
          return {
            ...current,
            writingPath: event.path,
            selectedPath: manualSelection.current ? current.selectedPath : event.path,
          };
        }
        if (event.status === 'error') {
          return {
            ...current,
            writingPath: current.writingPath === event.path ? null : current.writingPath,
            errors: { ...current.errors, [event.path]: event.message ?? 'La operacion fallo.' },
          };
        }
        const errors = { ...current.errors };
        delete errors[event.path];
        return { ...current, writingPath: current.writingPath === event.path ? null : current.writingPath, errors };
      });

      if (event.status !== 'en_curso') refresh();
    });
  }, [refresh, workspaceId]);

  // Contenido del archivo seleccionado. Se recarga cuando cambia la
  // seleccion o cuando el archivo termina de escribirse.
  //
  // Una imagen NUNCA se lee como texto: se pide su URL local y se muestra como
  // imagen. Leer un PNG en utf-8 producia cientos de miles de caracteres
  // binarios que el visor convertia en decenas de miles de nodos del DOM, y la
  // aplicacion se bloqueaba al abrir el archivo o al cambiar de pestana.
  useEffect(() => {
    const api = workspaceApi();
    const path = state.selectedPath;
    if (!api || !workspaceId || !path) return;

    let cancelled = false;

    if (fileKind(path) === 'imagen') {
      void api.previewUrl(workspaceId, path).then((response) => {
        if (cancelled) return;
        setState((current) => (current.selectedPath === path
          ? { ...current, selectedContent: '', selectedImageUrl: response.url ?? null }
          : current));
      });
      return () => { cancelled = true; };
    }

    // Un binario no se lee ni se muestra: `selectFile` ya limpio el contenido
    // anterior y el visor decide que pintar a partir de la extension.
    if (!isTextFile(path)) return undefined;

    void api.readFile(workspaceId, path).then((response) => {
      if (cancelled) return;
      setState((current) => (current.selectedPath === path
        ? { ...current, selectedContent: response.content ?? '', selectedImageUrl: null }
        : current));
    });
    return () => {
      cancelled = true;
    };
  }, [state.selectedPath, state.files, workspaceId]);

  const selectFile = useCallback((path: string) => {
    manualSelection.current = true;
    setState((current) => ({ ...current, selectedPath: path, selectedContent: '', selectedImageUrl: null }));
  }, []);

  /**
   * Guarda la edicion manual del usuario. Main aplica las mismas guardas que
   * al modelo: los archivos del sistema se rechazan y la ruta se valida contra
   * la raiz real del workspace.
   */
  const saveFile = useCallback(async (path: string, content: string): Promise<{ ok: boolean; message: string }> => {
    const api = workspaceApi();
    if (!api || !workspaceId) return { ok: false, message: 'No hay una presentacion activa.' };
    const response = await api.writeFile(workspaceId, path, content);
    if (!response.success) return { ok: false, message: response.error ?? 'No se pudo guardar el archivo.' };
    setState((current) => (current.selectedPath === path ? { ...current, selectedContent: content } : current));
    return { ok: true, message: 'Cambios guardados.' };
  }, [workspaceId]);

  const openFolder = useCallback(async () => {
    const api = workspaceApi();
    if (api && workspaceId) await api.openFolder(workspaceId);
  }, [workspaceId]);

  const exportHtml = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const api = presentationApi();
    if (!api || !workspaceId) return { ok: false, message: 'No hay una presentacion activa.' };
    const response = await api.exportHtml(workspaceId);
    return response.success
      ? { ok: true, message: 'Archivo HTML guardado en la carpeta: se abre en cualquier navegador y conserva las animaciones.' }
      : { ok: false, message: response.error ?? 'No se pudo exportar el archivo.' };
  }, [workspaceId]);

  const openFullscreen = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const api = presentationApi();
    if (!api || !workspaceId) return { ok: false, message: 'No hay una presentacion activa.' };
    const response = await api.open(workspaceId);
    return response.success
      ? { ok: true, message: '' }
      : { ok: false, message: response.error ?? 'No se pudo abrir la presentacion.' };
  }, [workspaceId]);

  return { state, refresh, selectFile, saveFile, openFolder, exportHtml, openFullscreen };
}

function initialState(): PresentationWorkspaceState {
  return {
    workspace: null,
    files: [],
    selectedPath: null,
    selectedContent: '',
    selectedImageUrl: null,
    writingPath: null,
    errors: {},
    ready: false,
    loading: true,
  };
}

function applyState(
  setState: React.Dispatch<React.SetStateAction<PresentationWorkspaceState>>,
  next: WorkspaceState,
): void {
  setState((current) => {
    // Al entrar se abre el documento, no la primera imagen de `assets/`.
    const preferido = next.files.find((file) => file.path === next.workspace.entryFile)
      ?? next.files.find((file) => isTextFile(file.path))
      ?? next.files[0];
    const selectedPath = current.selectedPath && next.files.some((file) => file.path === current.selectedPath)
      ? current.selectedPath
      : preferido?.path ?? null;
    return {
      ...current,
      workspace: next.workspace,
      files: next.files,
      selectedPath,
      ready: next.ready,
      loading: false,
    };
  });
}
