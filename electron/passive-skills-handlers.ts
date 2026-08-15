import { ipcMain } from 'electron';
import type { PassiveSkillsService } from './passive-skills/service';
import type { SavePassiveSkillInput } from './passive-skills/types';
import { handleIPC } from './utils/ipc-helpers';

export function registerPassiveSkillsHandlers(passiveSkillsService: PassiveSkillsService): void {
  // `profile` acota a un perfil de canal ('global' o el telefono del contacto).
  // Sin el se devuelven todas las reglas del usuario.
  ipcMain.handle('passive-skills:get-overview', (_event, profile?: unknown) =>
    handleIPC(async () => ({
      overview: await passiveSkillsService.getOverview(
        typeof profile === 'string' && profile.trim() ? profile.trim() : undefined,
      ),
    })));

  ipcMain.handle('passive-skills:save-rule', (_event, input: SavePassiveSkillInput) =>
    handleIPC(async () => ({
      rule: await passiveSkillsService.saveRule(input || ({} as SavePassiveSkillInput)),
    })));

  ipcMain.handle('passive-skills:delete-rule', (_event, ruleId: string) =>
    handleIPC(async () => ({
      deleted: await passiveSkillsService.deleteRule(String(ruleId || '').trim()),
    })));

  console.log('[PassiveSkillsHandlers] Registered successfully');
}
