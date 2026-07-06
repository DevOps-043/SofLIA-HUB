import type { Skill } from './skills-types';

/**
 * Skills EJECUTABLES (Fase 3): recetas reutilizables que el usuario/agente
 * guarda deliberadamente. Se almacenan en la tabla `skills`
 * (`skill_type='procedimiento_ejecutable'`, `content` = receta serializada) y su
 * EJECUCIÓN SIEMPRE pasa por el motor de Workspace Automation, que ya exige
 * aprobación (HITL) y soporta rollback. Aquí vive solo la lógica PURA de
 * serialización, matching y propuesta; nada ejecuta acciones por su cuenta.
 */

export type ExecutableRecipe = {
  /** Qué logra la receta (descripción para el usuario). */
  summary: string;
  /** Plantilla de Workspace Automation que la ejecuta (con su HITL). */
  templateId?: string;
};

const MIN_MATCH_SCORE = 0.3;

/** Serializa la receta al campo `content` de la skill. */
export function serializeRecipe(recipe: ExecutableRecipe): string {
  return JSON.stringify({ summary: recipe.summary, templateId: recipe.templateId ?? null });
}

/** Parsea el `content` de una skill ejecutable. Nunca lanza. */
export function parseRecipe(content: string): ExecutableRecipe | null {
  try {
    const data = JSON.parse(content) as Record<string, unknown>;
    const summary = String(data.summary ?? '').trim();
    if (!summary) return null;
    const templateId = data.templateId ? String(data.templateId) : undefined;
    return { summary, templateId };
  } catch {
    return null;
  }
}

/**
 * Encuentra la skill ejecutable que mejor responde a la petición del usuario,
 * por solapamiento de términos con el título y el contexto disparador. PURA.
 */
export function matchExecutableSkill(request: string, skills: Skill[]): { skill: Skill; score: number } | null {
  const requestTokens = tokenize(request);
  if (requestTokens.size === 0) return null;

  let best: { skill: Skill; score: number } | null = null;
  for (const skill of skills) {
    if (skill.type !== 'procedimiento_ejecutable') continue;
    const score = Math.max(
      jaccard(requestTokens, tokenize(skill.title)),
      jaccard(requestTokens, tokenize(skill.triggerContext ?? '')),
    );
    if (score >= MIN_MATCH_SCORE && (!best || score > best.score)) best = { skill, score };
  }
  return best;
}

/** Texto de propuesta para que el usuario confirme antes de ejecutar (HITL). PURA. */
export function buildRecipeProposal(skill: Skill, recipe: ExecutableRecipe): string {
  return [
    `Tengo un procedimiento guardado que parece encajar: *${skill.title}*.`,
    recipe.summary,
    '¿Quieres que lo ejecute? Necesitaré tu confirmación antes de hacer cualquier acción.',
  ].join('\n');
}

function tokenize(text: string): Set<string> {
  // NFD + quitar todo lo que no sea alfanumérico/espacio elimina también los
  // diacríticos combinantes (á→a), sin literales frágiles en el código.
  const normalized = String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, ' ');
  return new Set(normalized.split(/\s+/).filter((token) => token.length >= 3));
}

/**
 * Ejecuta una skill ejecutable delegando en el motor de Workspace Automation
 * (que exige aprobación HITL). NO ejecuta acciones aquí; solo dispara el flujo
 * aprobado. Devuelve el registro del run (con `needsApproval` si corresponde).
 */
export type ExecutableSkillRunDeps = {
  executeCustomTemplate: (payload: { templateId: string; input: Record<string, unknown> }) => Promise<unknown>;
};

export async function runExecutableSkill(
  deps: ExecutableSkillRunDeps,
  skill: Skill,
  request: string,
): Promise<{ ok: true; run: unknown } | { ok: false; reason: string }> {
  const recipe = parseRecipe(skill.content);
  if (!recipe) return { ok: false, reason: 'La receta guardada no es válida.' };
  if (!recipe.templateId) return { ok: false, reason: 'La receta no tiene un procedimiento ejecutable asociado.' };
  const run = await deps.executeCustomTemplate({ templateId: recipe.templateId, input: { request } });
  return { ok: true, run };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}
