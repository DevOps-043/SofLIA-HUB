/**
 * Clasificacion del archivo seleccionado en el panel.
 *
 * Existe por un fallo concreto: el panel leia CUALQUIER archivo como texto y
 * lo pintaba con numeros de linea. Al seleccionar un PNG de 582 KB, eso son
 * cientos de miles de caracteres binarios convertidos en decenas de miles de
 * nodos del DOM: la aplicacion se bloqueaba. Una imagen se muestra como
 * imagen; nunca se lee como texto.
 */
export type FileKind = 'texto' | 'imagen' | 'binario';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.md', '.json', '.txt', '.svg']);

export function fileKind(path: string | null | undefined): FileKind {
  const extension = extensionOf(path);
  // El SVG es las dos cosas: se muestra como imagen porque es lo que el
  // usuario espera ver, y su fuente sigue siendo legible desde la carpeta.
  if (IMAGE_EXTENSIONS.has(extension)) return 'imagen';
  if (TEXT_EXTENSIONS.has(extension)) return 'texto';
  return 'binario';
}

export function isTextFile(path: string | null | undefined): boolean {
  return fileKind(path) === 'texto';
}

/** Extensiones que el usuario puede editar desde el panel. */
export function isEditableFile(path: string | null | undefined, protectedFiles: readonly string[]): boolean {
  if (!path || !isTextFile(path)) return false;
  return !protectedFiles.includes(path);
}

function extensionOf(path: string | null | undefined): string {
  if (!path) return '';
  const nombre = path.split('/').pop() ?? '';
  const punto = nombre.lastIndexOf('.');
  return punto === -1 ? '' : nombre.slice(punto).toLowerCase();
}
