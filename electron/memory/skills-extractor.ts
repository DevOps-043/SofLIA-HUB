import { GoogleGenerativeAI } from '@google/generative-ai';
import { SUMMARIZE_MODEL } from './constants';
import { truncateToTokens } from './math';
import { buildExtractionGenerationConfig } from './model-config';
import { AUTO_LEARNABLE_SKILL_TYPES, type SkillType } from './skills-types';

/**
 * Aprendizaje autónomo de SKILLS: tras cada resumen de sesión, infiere
 * conocimiento durable que PERSONALIZA a los agentes (preferencias, correcciones
 * del usuario, contexto de trabajo, procedimientos que funcionaron). Reutiliza el
 * mismo modelo del resumidor. El parseo es PURO/testeable; el guardado usa el
 * store de skills (upsert con refuerzo), aislado por ownerKey.
 */

export type ParsedSkill = {
  type: SkillType;
  title: string;
  content: string;
  triggerContext?: string;
};

const MAX_TITLE = 80;
const MAX_CONTENT = 400;
const MAX_TRIGGER = 160;
const MAX_SKILLS_PER_SESSION = 6;

/** Parsea y valida la respuesta JSON del modelo. PURO. Nunca lanza. */
export function parseSkillsResponse(raw: string): ParsedSkill[] {
  let data: unknown;
  try {
    data = JSON.parse(stripJsonFence(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const skills: ParsedSkill[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const type = record.type ?? record.skill_type;
    const title = clean(record.title, MAX_TITLE);
    const content = clean(record.content ?? record.value, MAX_CONTENT);
    // Solo tipos AUTO-aprendibles: un procedimiento_ejecutable nunca se infiere solo.
    if (!isAutoLearnable(type) || !title || !content) continue;
    const triggerContext = clean(record.triggerContext ?? record.trigger_context ?? record.when, MAX_TRIGGER);
    skills.push({ type, title, content, ...(triggerContext ? { triggerContext } : {}) });
    if (skills.length >= MAX_SKILLS_PER_SESSION) break;
  }
  return skills;
}

export function buildSkillsExtractionPrompt(summaryText: string): string {
  return `Analiza este resumen y extrae SKILLS: conocimiento DURABLE que te ayude a trabajar MEJOR con este usuario en el futuro.
Tipos permitidos:
- "preferencia": cómo le gustan las cosas (formato de informes, tono, longitud, idioma...).
- "correccion": algo que te corrigió y no debes repetir.
- "contexto_trabajo": su rol, proyectos, herramientas, personas o datos recurrentes de su trabajo.
- "procedimiento": una forma de hacer una tarea que funcionó y conviene repetir.

NO incluyas acciones puntuales ya terminadas ni datos triviales. Solo lo que cambie tu comportamiento futuro.
Responde SOLO con un JSON array (máx 6). Si no hay skills durables, responde [].
Ejemplo: [{"type":"preferencia","title":"formato_informes","content":"Prefiere informes con bullets, fuentes citadas y un resumen ejecutivo arriba","triggerContext":"cuando pide un informe o investigación"}]

RESUMEN:
${truncateToTokens(summaryText, 1500)}

JSON:`;
}

/** Infiere y guarda skills desde un resumen. No bloqueante; errores se logean. */
export async function extractAndSaveSkills(
  service: any,
  ownerKey: string,
  summaryText: string,
  source: string,
): Promise<void> {
  if (!service.apiKey || !ownerKey) return;
  try {
    const genAI = new GoogleGenerativeAI(service.apiKey);
    const model = genAI.getGenerativeModel({
      model: SUMMARIZE_MODEL,
      generationConfig: buildExtractionGenerationConfig(),
    });
    const result = await model.generateContent(buildSkillsExtractionPrompt(summaryText));
    const skills = parseSkillsResponse(result.response.text().trim());
    for (const skill of skills) {
      service.saveSkill({ ownerKey, type: skill.type, title: skill.title, content: skill.content, triggerContext: skill.triggerContext, source });
    }
    if (skills.length > 0) console.log(`[MemoryService] Skills aprendidas: ${skills.length} para ${ownerKey}`);
  } catch (err: any) {
    console.warn('[MemoryService] extractAndSaveSkills error (no bloqueante):', err.message);
  }
}

function isAutoLearnable(value: unknown): value is SkillType {
  return typeof value === 'string' && (AUTO_LEARNABLE_SKILL_TYPES as readonly string[]).includes(value);
}

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function stripJsonFence(raw: string): string {
  return raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}
