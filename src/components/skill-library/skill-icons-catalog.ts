/**
 * Catalogo de iconos de Skills: identificadores y etiquetas.
 *
 * Se guarda el IDENTIFICADOR del icono, no el glifo: un emoji depende de la
 * fuente del sistema y se ve distinto en cada equipo, mientras que un trazo
 * SVG se ve igual en todos y hereda el color del tema.
 *
 * Los trazos viven en `skill-icons.tsx`. Estan separados porque ese archivo
 * exporta un componente y este solo datos.
 */

export type SkillIconId =
  | 'presentacion'
  | 'documento'
  | 'grafica'
  | 'tabla'
  | 'correo'
  | 'calendario'
  | 'busqueda'
  | 'codigo'
  | 'idea'
  | 'objetivo'
  | 'lista'
  | 'chat'
  | 'traducir'
  | 'resumen'
  | 'carpeta'
  | 'equipo'
  | 'finanzas'
  | 'proceso'
  | 'etiqueta'
  | 'herramienta';

/** Icono por defecto de una Skill sin icono elegido. */
export const DEFAULT_SKILL_ICON: SkillIconId = 'herramienta';

/** Orden en que se ofrecen en el selector de la configuracion. */
export const SKILL_ICONS: { id: SkillIconId; label: string }[] = [
  { id: 'presentacion', label: 'Presentacion' },
  { id: 'documento', label: 'Documento' },
  { id: 'grafica', label: 'Grafica' },
  { id: 'tabla', label: 'Tabla' },
  { id: 'resumen', label: 'Resumen' },
  { id: 'lista', label: 'Lista' },
  { id: 'correo', label: 'Correo' },
  { id: 'chat', label: 'Conversacion' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'busqueda', label: 'Busqueda' },
  { id: 'idea', label: 'Idea' },
  { id: 'objetivo', label: 'Objetivo' },
  { id: 'proceso', label: 'Proceso' },
  { id: 'codigo', label: 'Codigo' },
  { id: 'traducir', label: 'Traduccion' },
  { id: 'finanzas', label: 'Finanzas' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'carpeta', label: 'Carpeta' },
  { id: 'etiqueta', label: 'Etiqueta' },
  { id: 'herramienta', label: 'Herramienta' },
];

const IDS = new Set<string>(SKILL_ICONS.map((entry) => entry.id));

export function isSkillIconId(value: unknown): value is SkillIconId {
  return typeof value === 'string' && IDS.has(value);
}

/**
 * Resuelve un icono guardado. Las Skills creadas antes de este cambio traen
 * un emoji en ese campo; en vez de mostrarlo, se cae al icono por defecto
 * para que la biblioteca se vea uniforme.
 */
export function resolveSkillIcon(value: string | null | undefined): SkillIconId {
  return isSkillIconId(value) ? value : DEFAULT_SKILL_ICON;
}
