import type { FileCategoryInfo } from './types';

export function buildOrganizedFileMessage(
  fileName: string,
  categoryInfo: FileCategoryInfo,
): string {
  return [
    '*Archivo Organizado Automaticamente*',
    `*Nombre:* ${fileName}`,
    `*Categoria:* ${categoryInfo.category}`,
    `*Resumen:* ${categoryInfo.summary}`,
    `*Ubicacion:* Documentos/${categoryInfo.category}`,
  ].join('\n');
}
