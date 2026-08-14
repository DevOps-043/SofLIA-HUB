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

/**
 * Superficies del producto donde una Skill puede ofrecerse.
 *
 * La superficie es el eje TECNICO: de ella dependen el catalogo que se resuelve
 * y la allowlist de herramientas que una Skill puede aportar. No confundir con
 * el CANAL (`SkillChannel`), que es lo que el usuario elige.
 */
export type SkillSurface = 'chat' | 'whatsapp' | 'telegram';

export const SKILL_SURFACES: readonly SkillSurface[] = ['chat', 'whatsapp', 'telegram'];

export function isSkillSurface(value: unknown): value is SkillSurface {
  return value === 'chat' || value === 'whatsapp' || value === 'telegram';
}

/**
 * Canales donde el usuario decide que una Skill este activa.
 *
 * Es el eje DE PRODUCTO, y por eso no coincide con las superficies: la orbe y
 * el chat del Hub son un solo canal para el usuario ("mi computadora") y una
 * sola superficie para el sistema (`chat`), porque comparten agente, catalogo y
 * allowlist. Duplicar `chat` como superficie solo para nombrar el escritorio
 * obligaria a mantener dos listas de herramientas que unicamente pueden
 * divergir.
 */
export type SkillChannel = 'escritorio' | 'whatsapp' | 'telegram';

export const SKILL_CHANNELS: { value: SkillChannel; label: string; description: string }[] = [
  {
    value: 'escritorio',
    label: 'Computadora',
    description: 'SofLIA aparece en modo orbe y te lo dice en voz alta.',
  },
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    description: 'SofLIA te lo manda por mensaje de WhatsApp.',
  },
  {
    value: 'telegram',
    label: 'Telegram',
    description: 'SofLIA te lo manda por mensaje de Telegram.',
  },
];

export function isSkillChannel(value: unknown): value is SkillChannel {
  return value === 'escritorio' || value === 'whatsapp' || value === 'telegram';
}

/** Superficie sobre la que se resuelve un canal. */
export function channelToSurface(channel: SkillChannel): SkillSurface {
  return channel === 'escritorio' ? 'chat' : channel;
}

/** Canal que corresponde a una superficie. Inversa de `channelToSurface`. */
export function surfaceToChannel(surface: SkillSurface): SkillChannel {
  return surface === 'chat' ? 'escritorio' : surface;
}

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
   * Que pasa cuando la bandera no esta definida en el entorno.
   *
   * Por omision, apagada: una capacidad en desarrollo no debe aparecer sola.
   * Una Skill YA PUBLICADA declara lo contrario, porque de un instalador al que
   * le falte la variable no puede seguirse que la capacidad desaparezca para
   * todos sus usuarios.
   */
  readonly enabledByDefault?: boolean;
  /**
   * Bloqueada en conversaciones de grupo. Aplica a Skills cuyo resultado es
   * material del usuario: en un grupo, entregarlo lo expone a terceros.
   */
  readonly blockedInGroups?: boolean;
}

/**
 * Entrada del catalogo de Skills del sistema tal y como llega de la base de
 * datos, ANTES de acotarse.
 *
 * Todo campo es sospechoso hasta que `system-catalog.ts` lo valida: la fila
 * declara herramientas y politica de espacio de trabajo, y de ahi no puede
 * seguirse que la aplicacion las conceda tal cual. Los tipos son laxos a
 * proposito —la fila la escribe otro sistema— y el mapeo es quien decide.
 */
export interface SystemSkillRow {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly icon?: string | null;
  readonly command?: string | null;
  readonly category?: string | null;
  readonly surfaces?: readonly string[] | null;
  readonly sort_order?: number | null;
  readonly enabled?: boolean | null;
  readonly blocked_in_groups?: boolean | null;
  readonly starter_prompts?: unknown;
  readonly instructions?: string | null;
  readonly tools?: unknown;
  readonly workspace?: unknown;
  /** Una version anterior a esta ignora la fila en vez de malinterpretarla. */
  readonly min_app_version?: string | null;
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
