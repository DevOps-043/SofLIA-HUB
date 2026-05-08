import { describe, expect, it } from 'vitest';
import { createAgentWithService } from './create-agent';
import type { WhatsAppAgentTestContext } from './types';

export function registerCommandTests(ctx: WhatsAppAgentTestContext): void {
  describe('WA-040: /status command', () => {
    it('should respond with status info without entering agent loop', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', '/status');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('SofLIA'));
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
}
