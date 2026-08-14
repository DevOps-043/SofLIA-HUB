import { filterSkillTools } from './surface-tools';
import {
  isSkillCategory,
  isSkillSurface,
  type SkillSurface,
  type SkillWorkspacePolicy,
  type SystemSkill,
  type SystemSkillRow,
} from './types';

/**
 * Conversion de una fila del catalogo remoto en una Skill del sistema
 * utilizable, con TODO lo que la fila declara acotado antes de usarse.
 *
 * Por que existe: el catalogo del sistema vive en la base de datos para poder
 * administrarlo sin publicar version, y una fila declara instrucciones,
 * herramientas y politica de espacio de trabajo. De que una fila lo pida no
 * puede seguirse que la aplicacion lo conceda. Aqui es donde se decide.
 *
 * Modulo PURO: sin red, sin disco y sin `import.meta`. Lo usan igual el
 * renderer y main, que es lo que garantiza que el chat y WhatsApp acoten con
 * el mismo criterio.
 *
 * Un recorte nunca hace fallar la Skill: se ofrece con menos. Un catalogo mal
 * escrito degrada; no deja al usuario sin la capacidad.
 */

/** Extensiones que el producto admite en un espacio de trabajo de Skill. */
const EXTENSIONES_ADMITIDAS: ReadonlySet<string> = new Set([
  '.html', '.css', '.js', '.md', '.json', '.svg', '.txt', '.csv',
]);

/** Topes del producto. Una fila puede pedir menos, nunca mas. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_WORKSPACE_BYTES = 32 * 1024 * 1024;

/** Un espacio de trabajo sin extensiones utiles no serviria de nada. */
const EXTENSIONES_POR_DEFECTO: readonly string[] = ['.html', '.css', '.md'];

/**
 * Archivo de identidad que escribe el sistema y el modelo no puede tocar. Se
 * anade SIEMPRE, lo declare la fila o no. La capa base y el guion pertenecen
 * solo al runtime HTML heredado; protegerlos globalmente hacia que un workspace
 * React nuevo pareciera seguir usando la arquitectura anterior.
 */
const PROTEGIDOS_SIEMPRE: readonly string[] = [
  'estilos/marca.css',
];

function traza(mensaje: string, detalle?: unknown): void {
  console.warn(`[CatalogoSistema] ${mensaje}`, detalle ?? '');
}

function texto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function listaDeTextos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => texto(item)).filter(Boolean);
}

/**
 * Un solo segmento, sin ruta absoluta ni recorrido de directorios. La raiz la
 * compone main bajo su propio directorio de workspaces: cualquier cosa que
 * pretenda salir de ahi se descarta entera en vez de intentar repararse.
 */
export function sanitizeRootFolder(value: unknown, fallback: string): string {
  const crudo = texto(value);
  if (!crudo) return fallback;
  const limpio = crudo.replace(/^[/\\]+|[/\\]+$/g, '');
  const valido = /^[a-z0-9][a-z0-9._-]*$/i.test(limpio) && limpio !== '.' && limpio !== '..';
  if (!valido || /[/\\]/.test(limpio)) {
    traza('Carpeta raiz no admitida; se usa la del producto.', crudo);
    return fallback;
  }
  return limpio;
}

/** Ruta relativa contenida: sirve para el documento de entrada y los protegidos. */
function sanitizeRelativePath(value: unknown): string | null {
  const crudo = texto(value).replace(/\\/g, '/');
  if (!crudo) return null;
  if (crudo.startsWith('/') || /^[a-z]:/i.test(crudo)) return null;
  if (crudo.split('/').some((parte) => parte === '..' || parte === '')) return null;
  return crudo;
}

/**
 * Acota la politica declarada por una fila a lo que el producto admite.
 * Devuelve `null` cuando la fila no declara politica: una Skill sin espacio de
 * trabajo es legitima (solo aporta instrucciones).
 */
export function clampWorkspacePolicy(value: unknown, fallbackRoot = 'skills'): SkillWorkspacePolicy | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const cruda = value as Record<string, unknown>;

  const entryFile = sanitizeRelativePath(cruda.entryFile) ?? 'index.html';

  const declaradas = listaDeTextos(cruda.allowedExtensions).map((ext) => ext.toLowerCase());
  const admitidas = declaradas.filter((ext) => EXTENSIONES_ADMITIDAS.has(ext));
  const descartadas = declaradas.filter((ext) => !EXTENSIONES_ADMITIDAS.has(ext));
  if (descartadas.length > 0) traza('Extensiones no admitidas, descartadas:', descartadas);

  const protegidos = new Set(PROTEGIDOS_SIEMPRE);
  for (const declarado of listaDeTextos(cruda.protectedFiles)) {
    const limpio = sanitizeRelativePath(declarado);
    if (limpio) protegidos.add(limpio);
  }

  return {
    rootFolder: sanitizeRootFolder(cruda.rootFolder, fallbackRoot),
    allowedExtensions: admitidas.length > 0 ? admitidas : [...EXTENSIONES_POR_DEFECTO],
    maxFileBytes: tope(cruda.maxFileBytes, MAX_FILE_BYTES),
    maxWorkspaceBytes: tope(cruda.maxWorkspaceBytes, MAX_WORKSPACE_BYTES),
    entryFile,
    protectedFiles: [...protegidos],
  };
}

function tope(value: unknown, maximo: number): number {
  const numero = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  if (numero <= 0) return maximo;
  if (numero > maximo) {
    traza('Limite de tamano por encima del maximo del producto; se topa.', { pedido: numero, maximo });
    return maximo;
  }
  return numero;
}

/** Compara versiones `mayor.menor.parche`. Un formato invalido no bloquea nada. */
export function versionAlcanza(instalada: string, requerida: string | null | undefined): boolean {
  const pedida = texto(requerida);
  if (!pedida) return true;
  const partes = (valor: string) => valor.split('.').map((parte) => Number.parseInt(parte, 10));
  const actual = partes(instalada);
  const minima = partes(pedida);
  if (actual.some(Number.isNaN) || minima.some(Number.isNaN)) return true;

  for (let i = 0; i < Math.max(actual.length, minima.length); i += 1) {
    const izquierda = actual[i] ?? 0;
    const derecha = minima[i] ?? 0;
    if (izquierda !== derecha) return izquierda > derecha;
  }
  return true;
}

/**
 * Resultado de leer una fila para una superficie.
 *
 * Distinguir "no sirve aqui" de "no se entiende" es imprescindible: lo primero
 * es una decision DECLARADA —la fila acota las superficies— y debe retirar la
 * Skill de esta superficie aunque la version instalada la traiga. Lo segundo es
 * un error de escritura, y un error no puede retirar una capacidad.
 */
export type LecturaDeFila =
  | { estado: 'ok'; skill: SystemSkill }
  | { estado: 'otra-superficie' }
  | { estado: 'invalida' };

export function readSystemSkillRow(row: SystemSkillRow, surface: SkillSurface): LecturaDeFila {
  const id = texto(row?.id);
  const name = texto(row?.name);
  const instructions = texto(row?.instructions);
  if (!id || !name || !instructions) {
    traza('Fila incompleta, descartada:', row?.id);
    return { estado: 'invalida' };
  }

  const surfaces = listaDeTextos(row.surfaces).filter(isSkillSurface);
  if (!surfaces.includes(surface)) return { estado: 'otra-superficie' };

  const skill = componer(row, surface, { id, name, instructions, surfaces });
  return { estado: 'ok', skill };
}

/**
 * Convierte una fila en Skill del sistema para una superficie. Devuelve `null`
 * cuando la fila no sirve para esa superficie o le falta lo imprescindible.
 */
export function toSystemSkill(row: SystemSkillRow, surface: SkillSurface): SystemSkill | null {
  const lectura = readSystemSkillRow(row, surface);
  return lectura.estado === 'ok' ? lectura.skill : null;
}

function componer(
  row: SystemSkillRow,
  surface: SkillSurface,
  base: { id: string; name: string; instructions: string; surfaces: SkillSurface[] },
): SystemSkill {
  const { id, name, instructions, surfaces } = base;

  const category = texto(row.category);
  const command = texto(row.command);

  return {
    skillClass: 'sistema',
    id,
    name,
    description: texto(row.description) || null,
    icon: texto(row.icon) || 'herramienta',
    category: isSkillCategory(category) ? category : null,
    instructions,
    starterPrompts: listaDeTextos(row.starter_prompts),
    ...(command ? { command } : {}),
    surfaces,
    // La allowlist por superficie ya existe y es la misma que aplica el
    // catalogo del turno: no se duplica aqui, se reutiliza. Dos listas
    // acabarian divergiendo.
    tools: filterSkillTools(surface, listaDeTextos(row.tools)),
    workspace: clampWorkspacePolicy(row.workspace),
    blockedInGroups: row.blocked_in_groups === true,
  };
}

/**
 * Fusiona el catalogo remoto con el que trae la version instalada.
 *
 * La asimetria entre "no hay fila" y "fila deshabilitada" es deliberada: una
 * fila ausente respeta lo que trae la version, y solo una retirada DECLARADA
 * quita la Skill. Es lo que impide repetir el fallo de la bandera de entorno,
 * donde una variable que nadie declaro equivalia a apagar la capacidad para
 * todos los usuarios de esa version.
 */
export function mergeSystemSkills(input: {
  code: readonly SystemSkill[];
  rows: readonly SystemSkillRow[] | null;
  surface: SkillSurface;
  appVersion: string;
}): SystemSkill[] {
  const { code, rows, surface, appVersion } = input;
  // Sin catalogo remoto (consulta fallida) manda la version instalada entera.
  if (!rows) return [...code];

  const porId = new Map<string, SystemSkill>(code.map((skill) => [skill.id, skill]));
  const orden = new Map<string, number>();

  rows.forEach((row, indice) => {
    const id = texto(row?.id);
    if (!id) return;

    if (!versionAlcanza(appVersion, row.min_app_version)) {
      traza('Fila para una version posterior; se ignora.', { id, requiere: row.min_app_version });
      return;
    }

    if (row.enabled === false) {
      // Retirada declarada: manda sobre lo que traiga la version instalada.
      porId.delete(id);
      return;
    }

    const lectura = readSystemSkillRow(row, surface);
    if (lectura.estado === 'otra-superficie') {
      // Acotar las superficies es una decision declarada: retira la Skill de
      // esta aunque la version instalada la traiga.
      porId.delete(id);
      return;
    }
    if (lectura.estado === 'invalida') {
      // Un error de escritura no puede retirar una capacidad: si la version la
      // trae, se conserva.
      return;
    }

    const instalada = porId.get(id);
    // El prompt y el formato de workspace de Presentaciones forman parte del
    // mismo contrato que su runtime local. Una fila remota antigua puede
    // cambiar textos de catalogo, pero no volver a pedir index.html cuando la
    // version instalada solo sabe reproducir deck.json (ni al reves).
    const skill = id === 'sistema:presentaciones' && instalada
      ? { ...lectura.skill, instructions: instalada.instructions, workspace: instalada.workspace }
      : lectura.skill;
    porId.set(id, skill);
    orden.set(id, typeof row.sort_order === 'number' ? row.sort_order : 100 + indice);
  });

  return [...porId.values()].sort((izquierda, derecha) => {
    const a = orden.get(izquierda.id) ?? 100;
    const b = orden.get(derecha.id) ?? 100;
    return a === b ? izquierda.name.localeCompare(derecha.name) : a - b;
  });
}
