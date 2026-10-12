import type { WorkspaceFile } from '../../services/skills/workspace-bridge';
/** Editar notas no debe desmontar el reproductor y volver a cero. */
export function previewRevision(files: WorkspaceFile[], video: boolean): string {
  return files.filter(file => !video || ['film.json','salida/video.mp4','qa/informe.json'].includes(file.path)).map(file => `${file.path}:${file.bytes}:${file.updatedAt}`).join('|');
}
