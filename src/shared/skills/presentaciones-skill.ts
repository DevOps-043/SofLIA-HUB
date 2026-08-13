import { PRESENTACIONES_SKILL_PROMPT } from '../../prompts/skills/presentaciones';
import type { SystemSkill } from './types';
import { SKILL_WORKSPACE_TOOL_NAMES } from './workspace-tool-names';

/** Identificador estable de la Skill; se usa en IPC, telemetria y UI. */
export const PRESENTACIONES_SKILL_ID = 'sistema:presentaciones';

/** Manifiesto que consume el runtime React de presentaciones. */
export const PRESENTACIONES_ENTRY_FILE = 'deck.json';

/** Hoja de marca que escribe main antes de que el modelo empiece. */
export const PRESENTACIONES_BRAND_CSS = 'estilos/marca.css';

/** Capa de diseno comun; tambien la escribe el sistema. */
export const PRESENTACIONES_BASE_CSS = 'estilos/base.css';

/**
 * Guion base de la baraja. Lo escribe el sistema: dispara las entradas cuando
 * cada diapositiva llega a pantalla. Ligadas al scroll eran imperceptibles,
 * porque el salto de scroll-snap consumia el rango de entrada de golpe.
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
  surfaces: Object.freeze(['chat', 'whatsapp']) as readonly ('chat' | 'whatsapp')[],
  tools: Object.freeze([...SKILL_WORKSPACE_TOOL_NAMES]) as readonly string[],
  workspace: Object.freeze({
    rootFolder: 'presentaciones',
    allowedExtensions: Object.freeze(['.json', '.md']) as readonly string[],
    maxFileBytes: 512 * 1024,
    maxWorkspaceBytes: 8 * 1024 * 1024,
    entryFile: PRESENTACIONES_ENTRY_FILE,
    // La hoja de marca la escribe main. Que el modelo no pueda tocarla es lo
    // que garantiza que la identidad corporativa sea la real, aunque una
    // fuente intente convencerlo de usar otros colores.
    protectedFiles: Object.freeze([
      PRESENTACIONES_BRAND_CSS,
      PRESENTACIONES_BASE_CSS,
      PRESENTACIONES_BASE_JS,
    ]) as readonly string[],
  }),
  featureFlag: 'VITE_SKILL_PRESENTACIONES_ENABLED',
  // En un grupo, entregar la propuesta la expondria a todos sus miembros.
  blockedInGroups: true,
});
