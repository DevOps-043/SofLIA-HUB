import type { SkillFlagEnv } from '../../shared/skills/registry';

/**
 * Banderas de Skills del sistema para el RENDERER.
 *
 * Se leen CLAVE POR CLAVE a proposito: acceder a `import.meta.env` como
 * objeto hace que el bundler inline el entorno completo alli donde se use, y
 * este mapa lo consume codigo compartido con el proceso main.
 */
export const RENDERER_SKILL_FLAGS: SkillFlagEnv = {
  VITE_SKILL_PRESENTACIONES_ENABLED: import.meta.env.VITE_SKILL_PRESENTACIONES_ENABLED,
};
