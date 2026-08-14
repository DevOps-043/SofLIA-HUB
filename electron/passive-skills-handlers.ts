import { ipcMain } from 'electron';
import type { PassiveSkillsService } from './passive-skills/service';
import type { SavePassiveSkillInput } from './passive-skills/types';
import { handleIPC } from './utils/ipc-helpers';

export function registerPassiveSkillsHandlers(passiveSkillsService: PassiveSkillsService): void {
  ipcMain.handle('passive-skills:get-overview', () =>
    handleIPC(async () => ({
      overview: await passiveSkillsService.getOverview(),
    })));

  ipcMain.handle('passive-skills:save-rule', (_event, input: SavePassiveSkillInput) =>
    handleIPC(async () => ({
      rule: await passiveSkillsService.saveRule(input || ({} as SavePassiveSkillInput)),
    })));

  ipcMain.handle('passive-skills:delete-rule', (_event, ruleId: string) =>
    handleIPC(async () => ({
      deleted: passiveSkillsService.deleteRule(String(ruleId || '').trim()),
    })));

  console.log('[PassiveSkillsHandlers] Registered successfully');
}
