import { describe, expect, it, vi } from 'vitest';
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
      // El 4º arg es el ownerKey unificado; sin sesión ligada cae al scope por teléfono.
      expect(memory.assembleContext).toHaveBeenCalledWith('5215500000000', '5215500000000', 'test', 'phone:5215500000000');
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

  describe('WA-039: API error handling', () => {
    it('should send a classified error without losing the chat on infrastructure errors', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      ctx.mockSendMessage.mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED: quota exceeded'));
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'test');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.stringContaining('cuota'));
    });
  });

  describe('WA-039B: model fallback', () => {
    it('should retry with a fallback model when the primary model is unavailable', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      const primarySendMessage = vi.fn().mockRejectedValue(new Error('models/gemini-3.5-flash is not found for API version v1beta'));
      const fallbackSendMessage = vi.fn().mockResolvedValue({
        response: {
          text: () => 'OK fallback',
          candidates: [{ content: { parts: [{ text: 'OK fallback' }] } }],
          functionCalls: () => null,
        },
      });

      ctx.mockGetGenerativeModel
        .mockImplementationOnce(() => ({ startChat: () => ({ sendMessage: primarySendMessage }) }))
        .mockImplementationOnce(() => ({ startChat: () => ({ sendMessage: fallbackSendMessage }) }));

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');

      expect(ctx.mockGetGenerativeModel).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gemini-3.5-flash' }));
      expect(ctx.mockGetGenerativeModel).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-3.5-flash-lite' }));
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'OK fallback');
    });
  });
}
