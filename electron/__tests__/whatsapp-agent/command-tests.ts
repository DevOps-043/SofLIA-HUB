import { describe, expect, it } from 'vitest';
import { createAgentWithService } from './create-agent';
import type { WhatsAppAgentTestContext } from './types';

export function registerCommandTests(ctx: WhatsAppAgentTestContext): void {
  describe('WA-040: /status command', () => {
    it('should respond with status info without entering agent loop', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', '/status');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('Pulse'));
    });
  });

  describe('WA-041: /reset command', () => {
    it('should respond with reset confirmation', async () => {
      const waService = ctx.createMockWaService();
      const memory = ctx.createMockMemoryService();
      const agent = new (ctx.getWhatsAppAgent())(waService, 'test-key', memory, ctx.createMockKnowledgeService());
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', '/reset');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('reiniciada'));
      expect(memory.clearSessionContext).toHaveBeenCalled();
    });
  });

  describe('WA-042: /help command', () => {
    it('should respond with available commands', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', '/help');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('Comandos disponibles'));
    });
  });

  describe('WA-043: /perfil command', () => {
    it('should persist contact personalization when whitelist is active', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      waService.config.whitelistEnabled = true;
      waService.config.allowedNumbers = ['5215500000000'];
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', '/perfil nombre LIA');
      expect(waService.setPersonalization).toHaveBeenCalledWith({
        contactPersonalizations: {
          '5215500000000': { displayName: 'LIA' },
        },
      });
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('Guarde nombre'));
    });

    it('should persist group personalization from group chat', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      await agent.handleMessage('120363000000@g.us', '5215500000000', '/perfil tono directo', true);
      expect(waService.setPersonalization).toHaveBeenCalledWith({
        groupPersonalizations: {
          '120363000000@g.us': { tone: 'direct' },
        },
      });
    });
  });

  describe('WA-044: /permisos command', () => {
    it('should allow the master number to grant permissions', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      waService.config.masterNumber = '5215500000000';
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', '/permisos dar 5215511111111 pantalla archivos');
      expect(waService.setAccessConfig).toHaveBeenCalledWith({
        contactPermissions: {
          '5215511111111': ['screen_view', 'files_read'],
        },
      });
    });

    it('should reject permission changes from non-master numbers', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      waService.config.masterNumber = '5215500000000';
      await agent.handleMessage('123@s.whatsapp.net', '5215511111111', '/permisos dar 5215522222222 pantalla');
      expect(waService.setAccessConfig).not.toHaveBeenCalled();
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('Solo el numero maestro'));
    });
  });
}
