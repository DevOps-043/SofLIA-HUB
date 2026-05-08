import { describe, expect, it } from 'vitest';
import { createAgentWithService } from './create-agent';
import type { WhatsAppAgentTestContext } from './types';

export function registerContextMemoryTests(ctx: WhatsAppAgentTestContext): void {
  describe('WA-036: memory context injection', () => {
    it('should call memory.assembleContext during message processing', async () => {
      const waService = ctx.createMockWaService();
      const memory = ctx.createMockMemoryService();
      const agent = new (ctx.getWhatsAppAgent())(waService, 'test-key', memory, ctx.createMockKnowledgeService());
      ctx.mockTextResponse('Respuesta');
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'test');
      expect(memory.assembleContext).toHaveBeenCalledWith('5215500000000', '5215500000000', 'test');
    });
  });

  describe('WA-037: user message saved to memory', () => {
    it('should call memory.saveMessage for incoming user message', async () => {
      const waService = ctx.createMockWaService();
      const memory = ctx.createMockMemoryService();
      const agent = new (ctx.getWhatsAppAgent())(waService, 'test-key', memory, ctx.createMockKnowledgeService());
      ctx.mockTextResponse('OK');
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');
      expect(memory.saveMessage).toHaveBeenCalledWith(expect.objectContaining({
        role: 'user',
        content: 'Hola',
        phoneNumber: '5215500000000',
      }));
    });
  });

  describe('WA-038: knowledge context injected', () => {
    it('should call knowledge.getBootstrapContext with sender number', async () => {
      const waService = ctx.createMockWaService();
      const knowledge = ctx.createMockKnowledgeService();
      const agent = new (ctx.getWhatsAppAgent())(waService, 'test-key', ctx.createMockMemoryService(), knowledge);
      ctx.mockTextResponse('OK');
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'test');
      expect(knowledge.getBootstrapContext).toHaveBeenCalledWith('5215500000000');
    });
  });

  describe('WA-039: error handling resets conversation', () => {
    it('should send error message and auto-reset on exception', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      ctx.mockSendMessage.mockRejectedValueOnce(new Error('API Error'));
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'test');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('error'));
    });
  });
}
