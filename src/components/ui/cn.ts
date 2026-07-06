/**
 * Une clases condicionales en un solo string.
 * Reemplazo mínimo de `clsx` (no hay dependencia en el proyecto).
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
