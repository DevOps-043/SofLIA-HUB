import type { SkillWorkspacePolicy } from '../../shared/skills/types';

/**
 * Wrapper tipado del espacio de trabajo de Skills expuesto por preload.
 *
 * El renderer solo maneja rutas RELATIVAS: main es el unico que conoce la
 * ruta absoluta del workspace.
 */

export interface WorkspaceFile {
  path: string;
  bytes: number;
  updatedAt: string;
}

export interface WorkspaceRecord {
  id: string;
  skillId: string;
  conversationId: string | null;
  title: string;
  entryFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  workspace: WorkspaceRecord;
  files: WorkspaceFile[];
  totalBytes: number;
  /** Verdadero cuando existe el documento de entrada renderizable. */
  ready: boolean;
}

export type WorkspaceProgressEvent = {
  workspaceId: string;
  operation: 'escritura' | 'edicion' | 'borrado';
  path: string;
  status: 'en_curso' | 'completado' | 'error';
  bytes?: number;
  message?: string;
};

interface WorkspaceApi {
  create: (input: {
    skillId: string;
    title: string;
    conversationId?: string | null;
    policy: SkillWorkspacePolicy;
  }) => Promise<{ success: boolean; error?: string; workspace?: WorkspaceRecord }>;
  findByConversation: (conversationId: string) => Promise<{ success: boolean; workspace?: WorkspaceRecord | null }>;
  getState: (workspaceId: string) => Promise<{ success: boolean; error?: string; state?: WorkspaceState }>;
  readFile: (workspaceId: string, path: string) => Promise<{ success: boolean; error?: string; content?: string }>;
  /** Escritura manual desde el panel. Main aplica las mismas guardas que al modelo. */
  writeFile: (workspaceId: string, path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  openFolder: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  previewUrl: (workspaceId: string, entryFile?: string) => Promise<{ success: boolean; error?: string; url?: string }>;
  onProgress: (callback: (event: WorkspaceProgressEvent) => void) => () => void;
}

interface PresentationApi {
  open: (workspaceId: string, entryFile?: string) => Promise<{ success: boolean; error?: string }>;
  close: () => Promise<{ success: boolean; error?: string }>;
  onClosed: (callback: () => void) => () => void;
  exportHtml: (workspaceId: string, entryFile?: string) => Promise<{ success: boolean; error?: string; htmlPath?: string }>;
  prepareBranding: (input: { workspaceId: string; organizationId: string | null }) => Promise<{
    success: boolean;
    error?: string;
    branding?: {
      enabled: boolean;
      organizationName: string | null;
      colorSource: 'logo' | 'declarado' | 'neutro';
      missingAssets: string[];
      notice: string | null;
    };
  }>;
}

type WorkspaceScope = Window & {
  skillWorkspace?: WorkspaceApi;
  presentationView?: PresentationApi;
};

export function workspaceApi(): WorkspaceApi | null {
  if (typeof window === 'undefined') return null;
  return (window as WorkspaceScope).skillWorkspace ?? null;
}

export function presentationApi(): PresentationApi | null {
  if (typeof window === 'undefined') return null;
  return (window as WorkspaceScope).presentationView ?? null;
}
