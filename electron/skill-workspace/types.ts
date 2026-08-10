/**
 * Contratos del espacio de trabajo de una Skill del sistema.
 *
 * El renderer y el modelo solo ven rutas RELATIVAS al workspace; la ruta
 * absoluta nunca sale de main, para no filtrar el arbol de archivos del
 * usuario ni permitir que el modelo la reutilice en otras herramientas.
 */

export interface SkillWorkspacePolicyInput {
  rootFolder: string;
  allowedExtensions: readonly string[];
  maxFileBytes: number;
  maxWorkspaceBytes: number;
  entryFile: string;
  /** Archivos que escribe el sistema y el modelo no puede modificar. */
  protectedFiles?: readonly string[];
}

export interface SkillWorkspaceRecord {
  id: string;
  skillId: string;
  /** Conversacion que originó el workspace; permite retomarlo al volver. */
  conversationId: string | null;
  title: string;
  entryFile: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillWorkspaceFile {
  path: string;
  bytes: number;
  updatedAt: string;
}

export interface SkillWorkspaceState {
  workspace: SkillWorkspaceRecord;
  files: SkillWorkspaceFile[];
  totalBytes: number;
  /** Verdadero cuando existe el documento de entrada renderizable. */
  ready: boolean;
}

export type SkillWorkspaceOperation = 'escritura' | 'edicion' | 'borrado';

/** Evento de progreso por archivo que alimenta el panel del renderer. */
export interface SkillWorkspaceProgressEvent {
  workspaceId: string;
  operation: SkillWorkspaceOperation;
  path: string;
  status: 'en_curso' | 'completado' | 'error';
  bytes?: number;
  message?: string;
}

export type SkillWorkspaceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
