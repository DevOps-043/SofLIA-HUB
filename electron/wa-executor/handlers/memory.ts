/**
 * Handlers para tools de memoria y knowledge base.
 *
 * Cubre dos sistemas distintos pero relacionados:
 *  - **MemoryService**: lecciones aprendidas en runtime, almacenadas en
 *    SQLite local (`save_lesson`, `recall_memories`)
 *  - **KnowledgeService**: archivos .md persistentes estilo OpenClaw,
 *    inyectados al system prompt (`knowledge_save`, `knowledge_search`,
 *    `knowledge_log`, `knowledge_read`, `knowledge_update_user`)
 *
 * Las lecciones son user-facing y se llenan por feedback explícito;
 * el knowledge base es para datos persistentes a largo plazo.
 */

import { matchExecutableSkill, runExecutableSkill } from '../../memory/skills-executable';
import { phoneOwnerKey } from '../../memory/scope';
import { buildResponse, errorResponse, type FunctionResponse, type ToolExecutorContext } from '../types';

const MEMORY_TOOLS = new Set([
  'save_lesson',
  'recall_memories',
  'run_saved_procedure',
  'knowledge_save',
  'knowledge_update_user',
  'knowledge_search',
  'knowledge_log',
  'knowledge_read',
]);

const KNOWLEDGE_SEARCH_LIMIT = 8;

export function isMemoryTool(name: string): boolean {
  return MEMORY_TOOLS.has(name);
}

/**
 * Construye una key compacta y safe-fs a partir del texto de la lección,
 * para que la memoria sea consultable por keywords sin colisiones.
 */
function buildLessonKey(lesson: string): string {
  const sanitized = lesson
    .slice(0, 60)
    .replace(/[^a-zA-Z0-9áéíóúñ\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
  return sanitized || `lesson_${Date.now()}`;
}

export async function executeMemoryTool(
  toolName: string,
  toolArgs: Record<string, any>,
  ctx: ToolExecutorContext,
  senderNumber: string,
): Promise<FunctionResponse | null> {
  if (!MEMORY_TOOLS.has(toolName)) {
    return null;
  }

  try {
    switch (toolName) {
      case 'save_lesson': {
        const result = ctx.memory.saveFact({
          phoneNumber: senderNumber,
          category: 'correction',
          key: buildLessonKey(toolArgs.lesson as string),
          value: toolArgs.lesson,
          context: toolArgs.context || 'Aprendido en conversación WhatsApp',
        });
        console.log(`[WhatsApp Agent] Lesson saved via MemoryService: "${toolArgs.lesson}"`);
        return buildResponse(toolName, result as Record<string, unknown>);
      }

      case 'run_saved_procedure': {
        const request = String(toolArgs.request ?? toolArgs.procedure ?? '').trim();
        if (!request) return buildResponse(toolName, { success: false, message: 'Necesito saber qué procedimiento quieres ejecutar.' });
        const ownerKey = ctx.ownerKey || phoneOwnerKey(senderNumber);
        const match = matchExecutableSkill(request, ctx.memory.getExecutableSkills(ownerKey));
        if (!match) return buildResponse(toolName, { success: false, message: 'No tengo un procedimiento guardado que coincida con eso.' });
        if (!ctx.workspaceAutomation) return buildResponse(toolName, { success: false, message: 'El motor de automatización no está disponible ahora.' });
        const result = await runExecutableSkill(ctx.workspaceAutomation, match.skill, request);
        if (!result.ok) return buildResponse(toolName, { success: false, message: result.reason });
        ctx.memory.markSkillUsed(match.skill.id);
        return buildResponse(toolName, {
          success: true,
          procedure: match.skill.title,
          message: `Inicié el procedimiento "${match.skill.title}". Requiere tu aprobación antes de ejecutar cualquier acción.`,
        });
      }

      case 'recall_memories': {
        const facts = ctx.memory.getFacts(senderNumber);
        const lessons = facts.filter((f) => f.category === 'correction');
        return buildResponse(toolName, {
          success: true,
          memories: lessons.map((f) => f.value),
          count: lessons.length,
          message: lessons.length === 0 ? 'No hay lecciones guardadas aún.' : undefined,
        });
      }

      case 'knowledge_save':
        return buildResponse(toolName, ctx.knowledge.saveToMemory(toolArgs.content, toolArgs.section));

      case 'knowledge_update_user':
        return buildResponse(
          toolName,
          ctx.knowledge.updateUserProfile(senderNumber, toolArgs.section, toolArgs.content),
        );

      case 'knowledge_search': {
        const results = ctx.knowledge.searchKnowledge(toolArgs.query, KNOWLEDGE_SEARCH_LIMIT);
        return buildResponse(toolName, {
          success: true,
          results,
          count: results.length,
          message: results.length === 0 ? 'No se encontraron resultados.' : undefined,
        });
      }

      case 'knowledge_log':
        return buildResponse(toolName, ctx.knowledge.saveToDailyLog(toolArgs.content, senderNumber));

      case 'knowledge_read':
        return buildResponse(toolName, ctx.knowledge.readKnowledgeFile(toolArgs.file));

      default:
        return null;
    }
  } catch (err: any) {
    return errorResponse(toolName, err.message);
  }
}
