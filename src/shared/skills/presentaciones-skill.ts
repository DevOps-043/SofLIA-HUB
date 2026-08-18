import { PRESENTACIONES_SKILL_PROMPT } from '../../prompts/skills/presentaciones';
import type { SkillSurface, SystemSkill } from './types';
import { SKILL_WORKSPACE_TOOL_NAMES } from './workspace-tool-names';

/** Identificador estable de la Skill; se usa en IPC, telemetria y UI. */
export const PRESENTACIONES_SKILL_ID = 'sistema:presentaciones';

/** Manifiesto declarativo que consume el runtime React de presentaciones. */
export const PRESENTACIONES_ENTRY_FILE = 'deck.json';

/** Hoja de marca que escribe main antes de que el modelo empiece. */
export const PRESENTACIONES_BRAND_CSS = 'estilos/marca.css';

/** Capa de diseno del runtime HTML heredado; se conserva para workspaces antiguos. */
export const PRESENTACIONES_BASE_CSS = 'estilos/base.css';

/**
 * Guion del runtime HTML heredado; se conserva para workspaces antiguos.
 */
export const PRESENTACIONES_BASE_JS = 'guion-base.js';

/**
 * Skill del sistema que produce contenido estructurado para el runtime React.
 */
export const PRESENTACIONES_SKILL: SystemSkill = Object.freeze({
  skillClass: 'sistema',
  id: PRESENTACIONES_SKILL_ID,
  name: 'Presentaciones',
  // Mismo comando que en WhatsApp: se escribe igual en las dos superficies.
  command: 'presentacion',
  description:
    'Crea una presentacion ejecutiva animada con React, Tailwind y principios de HyperFrames, a partir de un archivo, Drive, una pagina web o tus indicaciones.',
  // Identificador del catalogo de iconos, no un emoji: se ve igual en todos
  // los equipos y hereda el color del tema.
  icon: 'presentacion',
  category: 'documentos',
  instructions: PRESENTACIONES_SKILL_PROMPT,
  starterPrompts: Object.freeze([
    'Crea una presentacion ejecutiva con la informacion de este documento',
    'Haz una presentacion de la pagina que tengo abierta en el navegador',
    'Prepara una propuesta comercial en diapositivas para un cliente',
  ]) as readonly string[],
  surfaces: Object.freeze(['chat', 'whatsapp', 'telegram']) as readonly SkillSurface[],
  tools: Object.freeze([...SKILL_WORKSPACE_TOOL_NAMES]) as readonly string[],
  workspace: Object.freeze({
    rootFolder: 'presentaciones',
    allowedExtensions: Object.freeze(['.json', '.md']) as readonly string[],
    maxFileBytes: 512 * 1024,
    maxWorkspaceBytes: 8 * 1024 * 1024,
    entryFile: PRESENTACIONES_ENTRY_FILE,
    // La hoja de marca la escribe main y ninguna fuente puede modificarla. Una
    // peticion explicita del usuario puede seleccionar otra paleta mediante el
    // contrato estricto `meta.tema`; el runtime la aplica solo dentro del deck.
    protectedFiles: Object.freeze([PRESENTACIONES_BRAND_CSS]) as readonly string[],
  }),
  featureFlag: 'VITE_SKILL_PRESENTACIONES_ENABLED',
  // Capacidad publicada: la bandera es su interruptor de APAGADO, no el
  // permiso para existir. Cuando exigia un `true` explicito, un instalador
  // generado sin esa variable salia sin la Skill —ni comando, ni biblioteca—
  // para todos sus usuarios, y el build terminaba en verde.
  enabledByDefault: true,
  // En un grupo, entregar la propuesta la expondria a todos sus miembros.
  blockedInGroups: true,
});
