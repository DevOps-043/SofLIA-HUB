import type { PreloadBridge, SafeIpc } from './types';

/**
 * Superficie del espacio de trabajo de Skills y de las presentaciones.
 *
 * Todas las rutas que cruzan esta frontera son RELATIVAS al workspace: main
 * es el unico que conoce la ruta absoluta, de modo que ni el renderer ni el
 * modelo pueden reutilizarla contra otras herramientas del sistema.
 */
export function exposeSkillWorkspaceApi(bridge: PreloadBridge, ipc: SafeIpc): void {
  const { safeInvoke, safeOn } = ipc;

  bridge.exposeInMainWorld('skillWorkspace', {
    create: (input: {
      skillId: string;
      title: string;
      conversationId?: string | null;
      policy: {
        rootFolder: string;
        allowedExtensions: readonly string[];
        maxFileBytes: number;
        maxWorkspaceBytes: number;
        entryFile: string;
      };
    }) => safeInvoke('skill-workspace:create', input),

    findByConversation: (conversationId: string) =>
      safeInvoke('skill-workspace:find-by-conversation', { conversationId }),

    getState: (workspaceId: string) => safeInvoke('skill-workspace:get-state', { workspaceId }),

    readFile: (workspaceId: string, path: string) =>
      safeInvoke('skill-workspace:read-file', { workspaceId, path }),

    writeFile: (workspaceId: string, path: string, content: string) =>
      safeInvoke('skill-workspace:write-file', { workspaceId, path, content }),

    editFile: (workspaceId: string, path: string, search: string, replace: string, replaceAll = false) =>
      safeInvoke('skill-workspace:edit-file', { workspaceId, path, search, replace, replaceAll }),

    deleteFile: (workspaceId: string, path: string) =>
      safeInvoke('skill-workspace:delete-file', { workspaceId, path }),

    openFolder: (workspaceId: string) => safeInvoke('skill-workspace:open-folder', { workspaceId }),

    remove: (workspaceId: string) => safeInvoke('skill-workspace:delete', { workspaceId }),

    /** URL del protocolo local con la que el iframe carga la presentacion. */
    previewUrl: (workspaceId: string, entryFile?: string) =>
      safeInvoke('skill-workspace:preview-url', { workspaceId, entryFile }),

    /** Guarda una imagen ya generada (base64) en `assets/`. */
    writeImage: (workspaceId: string, fileName: string, base64: string) =>
      safeInvoke('skill-workspace:write-image', { workspaceId, fileName, base64 }),

    /** Descarga una imagen a `assets/`. Main aplica las guardas de red. */
    downloadImage: (workspaceId: string, url: string, fileName: string) =>
      safeInvoke('skill-workspace:download-image', { workspaceId, url, fileName }),

    onProgress: (callback: (event: unknown) => void) => safeOn('skill-workspace:progress', callback),
  });

  bridge.exposeInMainWorld('presentationView', {
    open: (workspaceId: string, entryFile?: string) =>
      safeInvoke('presentation-view:open', { workspaceId, entryFile }),
    close: () => safeInvoke('presentation-view:close'),
    onClosed: (callback: () => void) => safeOn('presentation-view:closed', callback),
    exportHtml: (workspaceId: string, entryFile?: string) =>
      safeInvoke('presentation:export-html', { workspaceId, entryFile }),
    prepareBranding: (input: { workspaceId: string; organizationId: string | null }) =>
      safeInvoke('presentation:prepare-branding', input),
  });
}
