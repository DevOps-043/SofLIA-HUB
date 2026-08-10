/**
 * Modelo unico de Skill: una capacidad nombrada e invocable que SofLIA
 * ofrece con el mismo contrato en el chat del Hub y en WhatsApp.
 *
 * Sustituye a los dos modelos anteriores: los "flujos activos" de WhatsApp
 * (maquinas de estado acopladas al canal) y las "herramientas del usuario"
 * (presets de prompt solo del chat).
 *
 * No confundir con `electron/memory/skills-*.ts`, que modela MEMORIA
 * APRENDIDA del usuario (preferencias, correcciones) y no es invocable.
 */

/** Superficies del producto donde una Skill puede ofrecerse. */
export type SkillSurface = 'chat' | 'whatsapp';

export const SKILL_SURFACES: readonly SkillSurface[] = ['chat', 'whatsapp'];

/**
 * Clase de una Skill. SIEMPRE se deriva de la fuente de la declaracion,
 * nunca de una columna de la base de datos: una fila de `public.skills` es
 * `usuario` por construccion y no puede convertirse en `sistema`.
 */
export type SkillClass = 'sistema' | 'usuario';

export type SkillCategory =
  | 'desarrollo'
  | 'marketing'
  | 'educacion'
  | 'productividad'
  | 'creatividad'
  | 'analisis'
  | 'documentos'
  | 'diagramas'
  | 'comunicacion';

export const SKILL_CATEGORIES: { value: SkillCategory; label: string; icon: string }[] = [
  { value: 'desarrollo', label: 'Desarrollo', icon: '\u{1F4BB}' },
  { value: 'marketing', label: 'Marketing', icon: '\u{1F4E3}' },
  { value: 'educacion', label: 'Educacion', icon: '\u{1F393}' },
  { value: 'productividad', label: 'Productividad', icon: '\u{1F4CB}' },
  { value: 'creatividad', label: 'Creatividad', icon: '\u{1F3A8}' },
  { value: 'analisis', label: 'Analisis', icon: '\u{1F4CA}' },
  { value: 'documentos', label: 'Documentos', icon: '\u{1F4C4}' },
  { value: 'diagramas', label: 'Diagramas', icon: '\u{1F500}' },
  { value: 'comunicacion', label: 'Comunicacion', icon: '✉️' },
];

export function isSkillCategory(value: unknown): value is SkillCategory {
  return typeof value === 'string' && SKILL_CATEGORIES.some((entry) => entry.value === value);
}

/**
 * Politica del espacio de trabajo de una Skill. Solo las Skills del sistema
 * pueden declararla: define el directorio aislado donde el modelo escribe su
 * entregable y los limites que main aplica sobre cada operacion de archivo.
 */
export interface SkillWorkspacePolicy {
  /** Subcarpeta bajo la raiz de workspaces gestionada por main. */
  readonly rootFolder: string;
  /** Extensiones que la Skill puede escribir, en minusculas y con punto. */
  readonly allowedExtensions: readonly string[];
  /** Limite por archivo, en bytes. */
  readonly maxFileBytes: number;
  /** Limite acumulado del workspace, en bytes. */
  readonly maxWorkspaceBytes: number;
  /** Documento que abre la vista previa, relativo al workspace. */
  readonly entryFile: string;
  /**
   * Archivos que escribe el sistema y el modelo NO puede modificar. Es lo que
   * impide que una inyeccion en una fuente lleve al modelo a reescribir la
   * hoja de marca y suplantar la identidad de la organizacion.
   */
  readonly protectedFiles: readonly string[];
}

/** Campos comunes a toda Skill, independientemente de su clase. */
interface SkillBase {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** Identificador del icono, no un glifo. Ver `skill-icons.tsx`. */
  readonly icon: string;
  readonly category: SkillCategory | null;
  /** Instrucciones que se anexan al prompt del turno cuando esta activa. */
  readonly instructions: string;
  readonly starterPrompts: readonly string[];
}

/**
 * Skill declarada en codigo. Puede aportar herramientas y un workspace.
 * Las herramientas aportadas se validan contra la allowlist de la superficie
 * antes de exponerse: una Skill activa lo que la superficie permite pero no
 * ofrece por defecto, y nunca amplia lo que la superficie prohibe.
 */
export interface SystemSkill extends SkillBase {
  readonly skillClass: 'sistema';
  /**
   * Comando con el que se invoca desde el compositor, sin la barra. Se
   * declara para que sea el MISMO en todas las superficies: el nombre de la
   * Skill puede cambiar sin romper lo que el usuario ya tiene aprendido.
   * Ausente = se deriva del nombre, como en las Skills del usuario.
   */
  readonly command?: string;
  readonly surfaces: readonly SkillSurface[];
  /** Nombres de herramientas que la Skill anade al catalogo del turno. */
  readonly tools: readonly string[];
  readonly workspace: SkillWorkspacePolicy | null;
  /** Bandera de entorno que habilita la Skill. Ausente = siempre activa. */
  readonly featureFlag?: string;
  /**
   * Bloqueada en conversaciones de grupo. Aplica a Skills cuyo resultado es
   * material del usuario: en un grupo, entregarlo lo expone a terceros.
   */
  readonly blockedInGroups?: boolean;
}

/** Skill creada por el usuario. Solo instrucciones y prompts de inicio. */
export interface UserSkill extends SkillBase {
  readonly skillClass: 'usuario';
  readonly userId: string;
  /**
   * Comando de invocacion configurado por el usuario, sin la barra. Nulo
   * significa que se deriva del nombre.
   */
  readonly command: string | null;
  readonly isFavorite: boolean;
  readonly usageCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type Skill = SystemSkill | UserSkill;

export function isSystemSkill(skill: Skill): skill is SystemSkill {
  return skill.skillClass === 'sistema';
}

export function isUserSkill(skill: Skill): skill is UserSkill {
  return skill.skillClass === 'usuario';
}

export interface CreateUserSkillInput {
  name: string;
  description?: string;
  icon?: string;
  /** Comando de invocacion. Vacio = derivado del nombre. */
  command?: string | null;
  category?: SkillCategory;
  instructions: string;
  starterPrompts?: string[];
}

export type UpdateUserSkillInput = Partial<CreateUserSkillInput>;
