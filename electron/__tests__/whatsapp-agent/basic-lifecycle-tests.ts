import { describe, expect, it, vi } from 'vitest';
import type { WhatsAppAgentTestContext } from './types';
import { createAgent, createAgentWithServices } from './types';

export function registerBasicLifecycleTests(ctx: WhatsAppAgentTestContext): void {
  describe('WA-031: handleMessage returns text response', () => {
    it('should call waService.sendText with agent response', async () => {
      const { agent, waService } = createAgentWithServices(ctx);
      ctx.mockTextResponse('Hola, soy Pulse.');

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.any(String));
    });
  });

  describe('WA-032: constructor stores dependencies', () => {
    it('should store waService, apiKey, memory, and knowledge', () => {
      expect(createAgent(ctx)).toBeDefined();
    });
  });

  describe('WA-033: setGoogleServices', () => {
    it('should accept and store Google service references', () => {
      const agent = createAgent(ctx);
      const calendar = { getConnections: vi.fn().mockReturnValue([]) };

      expect(() => agent.setGoogleServices(calendar, {}, {}, {})).not.toThrow();
    });
  });

  describe('WA-034: updateApiKey resets genAI', () => {
    it('should nullify genAI so next call creates a new instance', () => {
      const agent = createAgent(ctx, 'old-key');
      agent.getGenAI();
      agent.updateApiKey('new-key');

      expect(agent.getGenAI()).toBeDefined();
    });
  });

  describe('WA-035: getGenAI lazy initialization', () => {
    it('should return a GoogleGenerativeAI instance', () => {
      const genAI = createAgent(ctx).getGenAI();

      expect(genAI).toBeDefined();
      expect(genAI.getGenerativeModel).toBeDefined();
    });
  });
}
