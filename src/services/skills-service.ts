/**
 * API publica de Skills para el renderer.
 *
 * Sustituye a `tools-service.ts` (herramientas del usuario). Las Skills del
 * sistema se declaran en `src/shared/skills/registry.ts` y las del usuario
 * viven en `public.skills`.
 */

export { resolveSkillCatalog } from './skills/catalog';
export type { SkillCatalog } from './skills/catalog';

export {
  createUserSkill,
  deleteUserSkill,
  listUserSkills,
  markUserSkillUsed,
  updateUserSkill,
} from './skills/user-skills-store';

export {
  SYSTEM_SKILLS,
  findSystemSkill,
  isSystemSkillEnabled,
  isSystemSkillId,
  systemSkillsForSurface,
} from '../shared/skills/registry';

export {
  SKILL_CATEGORIES,
  SKILL_SURFACES,
  isSkillCategory,
  isSystemSkill,
  isUserSkill,
} from '../shared/skills/types';

export type {
  CreateUserSkillInput,
  Skill,
  SkillCategory,
  SkillClass,
  SkillSurface,
  SkillWorkspacePolicy,
  SystemSkill,
  UpdateUserSkillInput,
  UserSkill,
} from '../shared/skills/types';
