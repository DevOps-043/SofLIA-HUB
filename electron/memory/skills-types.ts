/**
 * Skills = conocimiento durable aprendido del usuario que PERSONALIZA a los
 * agentes (preferencias, formato preferido, fuentes confiables, correcciones,
 * contexto de trabajo, procedimientos que funcionaron). Se inyecta al prompt de
 * todas las superficies. Fase 3 añadira `procedimiento_ejecutable` (recetas).
 */

export type SkillType = 'preferencia' | 'procedimiento' | 'correccion' | 'contexto_trabajo' | 'procedimiento_ejecutable';

export const SKILL_TYPES: readonly SkillType[] = ['preferencia', 'procedimiento', 'correccion', 'contexto_trabajo', 'procedimiento_ejecutable'];

/**
 * Tipos que el aprendizaje AUTÓNOMO puede inferir. `procedimiento_ejecutable`
 * se excluye a propósito: una receta que EJECUTA acciones solo se guarda de
 * forma deliberada (nunca auto-inferida), por seguridad.
 */
export const AUTO_LEARNABLE_SKILL_TYPES: readonly SkillType[] = ['preferencia', 'procedimiento', 'correccion', 'contexto_trabajo'];

export function isSkillType(value: unknown): value is SkillType {
  return typeof value === 'string' && (SKILL_TYPES as readonly string[]).includes(value);
}

export interface SkillInput {
  ownerKey: string;
  type: SkillType;
  /** Titulo corto y estable (clave de dedup junto a owner+type). */
  title: string;
  /** Contenido accionable de la skill (que debe hacer/recordar el agente). */
  content: string;
  /** Cuando aplica esta skill (contexto disparador), para recall. */
  triggerContext?: string;
  /** Origen del aprendizaje: 'chat' | 'whatsapp' | 'desktop' | 'manual' | ... */
  source?: string;
  /** Confianza inicial 0-1 (default 0.6). Se refuerza al reaparecer. */
  confidence?: number;
}

export interface Skill {
  id: number;
  ownerKey: string;
  type: SkillType;
  title: string;
  content: string;
  triggerContext: string | null;
  confidence: number;
  usageCount: number;
  lastUsedAt: string | null;
  source: string | null;
}
