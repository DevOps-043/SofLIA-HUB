import { PRESENTACIONES_SKILL } from './presentaciones-skill';
import type { SkillSurface, SystemSkill } from './types';

/**
 * Registro de Skills del SISTEMA. Declaradas en codigo a proposito: pueden
 * aportar herramientas y un espacio de trabajo, de modo que su definicion
 * debe estar versionada con el producto y no ser escribible desde la base
 * de datos.
 *
 * Compartido por renderer y main para que ambas superficies resuelvan el
 * mismo catalogo con las mismas reglas.
 */
export const SYSTEM_SKILLS: readonly SystemSkill[] = Object.freeze([
  PRESENTACIONES_SKILL,
]);

const SYSTEM_SKILL_IDS: ReadonlySet<string> = new Set(SYSTEM_SKILLS.map((skill) => skill.id));

/**
 * Entorno del que se leen las banderas. Cada superficie pasa el suyo: main
 * entrega `process.env` y el renderer un objeto con las claves concretas.
 *
 * Este modulo NO lee `import.meta.env`: hacerlo desde codigo compartido llevo
 * al bundler a inlinear el objeto de entorno COMPLETO (con las claves de API)
 * dentro de un chunk del proceso main, y ademas congelaba el valor de la
 * bandera en tiempo de build, por encima del `process.env` real.
 */
export type SkillFlagEnv = Record<string, string | undefined>;

/**
 * Una Skill del sistema esta habilitada si no declara bandera, o segun lo que
 * diga su bandera en el entorno recibido.
 *
 * La bandera SIN DEFINIR no significa lo mismo para todas: una capacidad en
 * desarrollo se queda apagada, y una ya publicada se queda encendida. La
 * diferencia importa porque el `.env` del instalador se genera en el runner:
 * una variable que nadie declaro alli hacia desaparecer la Skill para todos
 * los usuarios de esa version, sin que nada fallara en el build.
 */
export function isSystemSkillEnabled(skill: SystemSkill, env: SkillFlagEnv = {}): boolean {
  if (!skill.featureFlag) return true;
  const value = (env[skill.featureFlag] ?? '').trim().toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return skill.enabledByDefault === true;
}

/**
 * Skill apagada EXPLICITAMENTE por el entorno local.
 *
 * Es el interruptor de emergencia del equipo: manda sobre el catalogo remoto,
 * de modo que un despliegue pueda retirar una capacidad sin depender de que la
 * base de datos responda. Solo cuenta el apagado declarado; la variable
 * ausente no apaga nada.
 */
export function isSystemSkillDisabledByEnv(id: string, env: SkillFlagEnv = {}): boolean {
  const skill = findSystemSkill(id);
  if (!skill?.featureFlag) return false;
  const value = (env[skill.featureFlag] ?? '').trim().toLowerCase();
  return value === 'false' || value === '0';
}

/** Skills del sistema disponibles en una superficie, ya filtradas por bandera. */
export function systemSkillsForSurface(surface: SkillSurface, env: SkillFlagEnv = {}): SystemSkill[] {
  return SYSTEM_SKILLS.filter(
    (skill) => skill.surfaces.includes(surface) && isSystemSkillEnabled(skill, env),
  );
}

export function findSystemSkill(id: string): SystemSkill | null {
  return SYSTEM_SKILLS.find((skill) => skill.id === id) ?? null;
}

/**
 * Un identificador de Skill del sistema nunca puede provenir de la base de
 * datos. Se usa para rechazar filas que intenten suplantar una declaracion.
 */
export function isSystemSkillId(id: string): boolean {
  return SYSTEM_SKILL_IDS.has(id);
}
