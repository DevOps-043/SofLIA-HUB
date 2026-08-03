/**
 * MemoryHandlers — IPC handlers for memory management.
 * Exposes memory stats, compaction, and fact management to the renderer process.
 */
import { ipcMain } from 'electron';
import type { MemoryService } from './memory-service';
import { setCurrentUserId } from './memory/owner-context';
import { buildRecipeProposal, matchExecutableSkill, parseRecipe, runExecutableSkill, serializeRecipe } from './memory/skills-executable';
import { handleIPC } from './utils/ipc-helpers';

/** Motor que ejecuta procedimientos con HITL (Workspace Automation). */
type ExecutableSkillEngine = {
  executeCustomTemplate: (payload: { templateId: string; input: Record<string, unknown> }) => Promise<unknown>;
};

export function registerMemoryHandlers(memoryService: MemoryService, executableEngine?: ExecutableSkillEngine | null): void {
  ipcMain.handle('memory:get-stats', async (_event, sessionKey?: string) => {
    return memoryService.getStats(sessionKey);
  });

  ipcMain.handle('memory:compact', (_event, daysToKeep?: number) =>
    handleIPC(() => memoryService.compactOldData(daysToKeep || 3650)));

  ipcMain.handle('memory:get-facts', async (_event, phoneNumber: string) => {
    return memoryService.getFacts(phoneNumber);
  });

  ipcMain.handle('memory:delete-fact', async (_event, factId: number) => {
    const ok = memoryService.deleteFact(factId);
    return { success: ok };
  });

  ipcMain.handle('memory:search', (_event, sessionKey: string, phoneNumber: string, query: string) =>
    handleIPC(async () => ({ results: await memoryService.searchMemory(sessionKey, phoneNumber, query) })));

  // Skills aprendidas: el usuario puede ver y borrar lo que Pulse aprendio.
  ipcMain.handle('memory:list-skills', async (_event, ownerKey: string) => {
    return memoryService.listSkills(ownerKey);
  });

  ipcMain.handle('memory:delete-skill', async (_event, skillId: number) => {
    return { success: memoryService.deleteSkill(skillId) };
  });

  // Owner actual del equipo (usuario con sesión): permite que superficies del
  // main sin identidad propia (agente de escritorio) escriban en la misma memoria.
  ipcMain.handle('memory:set-current-user', (_event, userId: string | null) => {
    setCurrentUserId(userId);
    return { success: true };
  });

  // --- Memoria unificada del chat de la app (mismo motor que WhatsApp) ---
  // Contexto de memoria (recientes + resumenes + semantico + facts + SKILLS)
  // formateado para inyectar en el prompt del chat, por owner.
  ipcMain.handle('memory:context', (_event, ownerKey: string, sessionKey: string, currentMessage: string) =>
    handleIPC(async () => {
      const ctx = await memoryService.assembleContext(sessionKey, ownerKey, currentMessage || '', ownerKey);
      return { context: memoryService.formatContextForPrompt(ctx) };
    }));

  // Registra un turno del chat (usuario + asistente) en la memoria del owner,
  // disparando resumen/aprendizaje autonomo igual que en WhatsApp.
  ipcMain.handle('memory:record-turn', (_event, ownerKey: string, sessionKey: string, userText: string, assistantText: string) =>
    handleIPC(async () => {
      if (userText?.trim()) memoryService.saveMessage({ sessionKey, phoneNumber: ownerKey, ownerKey, role: 'user', content: userText });
      if (assistantText?.trim()) memoryService.saveMessage({ sessionKey, phoneNumber: ownerKey, ownerKey, role: 'model', content: assistantText });
      return { success: true };
    }));

  // --- Skills EJECUTABLES (Fase 3): recetas reutilizables con HITL ---
  // Guardar una receta (deliberado, nunca auto): title + summary + templateId de
  // Workspace Automation que la ejecuta con aprobación.
  ipcMain.handle('memory:save-executable-skill', (_event, ownerKey: string, title: string, summary: string, templateId: string | null, triggerContext?: string) =>
    handleIPC(async () => memoryService.saveSkill({
      ownerKey, type: 'procedimiento_ejecutable', title,
      content: serializeRecipe({ summary, templateId: templateId || undefined }),
      triggerContext, source: 'manual',
    })));

  ipcMain.handle('memory:list-executable-skills', async (_event, ownerKey: string) =>
    memoryService.listSkills(ownerKey).filter((skill) => skill.type === 'procedimiento_ejecutable'));

  // Buscar una receta que responda a la petición (para proponerla). NO ejecuta.
  ipcMain.handle('memory:match-executable-skill', (_event, ownerKey: string, request: string) =>
    handleIPC(async () => {
      const match = matchExecutableSkill(request, memoryService.listSkills(ownerKey));
      if (!match) return { match: null };
      const recipe = parseRecipe(match.skill.content);
      return { match: { skillId: match.skill.id, title: match.skill.title, score: match.score, proposal: recipe ? buildRecipeProposal(match.skill, recipe) : match.skill.content } };
    }));

  // Ejecutar una receta: delega al motor HITL (Workspace Automation). Sin motor
  // configurado, no ejecuta nada.
  ipcMain.handle('memory:run-executable-skill', (_event, ownerKey: string, skillId: number, request: string) =>
    handleIPC(async () => {
      if (!executableEngine) return { ok: false, reason: 'Motor de automatización no disponible.' };
      const skill = memoryService.listSkills(ownerKey).find((item) => item.id === skillId && item.type === 'procedimiento_ejecutable');
      if (!skill) return { ok: false, reason: 'No encontré ese procedimiento.' };
      const result = await runExecutableSkill(executableEngine, skill, request);
      if (result.ok) memoryService.markSkillUsed(skillId);
      return result;
    }));

  console.log('[MemoryHandlers] Registered successfully');
}
