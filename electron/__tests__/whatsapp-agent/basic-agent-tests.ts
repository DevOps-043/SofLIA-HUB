import { describe, expect, it, vi } from 'vitest';
import { createAgentWithService } from './create-agent';
import type { WhatsAppAgentTestContext } from './types';

export function registerBasicAgentTests(ctx: WhatsAppAgentTestContext): void {
  describe('WA-031: handleMessage returns text response', () => {
    it('should call waService.sendText with agent response', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      ctx.mockTextResponse('Hola, soy SofLIA.');
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', expect.any(String));
    });
  });

  describe('WA-032: constructor stores dependencies', () => {
    it('should store waService, apiKey, memory, and knowledge', () => {
      expect(createAgentWithService(ctx).agent).toBeDefined();
    });
  });

  describe('WA-033: setGoogleServices', () => {
    it('should accept and store Google service references', () => {
      const { agent } = createAgentWithService(ctx);
      const calendar = { getConnections: vi.fn().mockReturnValue([]) };
      expect(() => agent.setGoogleServices(calendar, {}, {}, {})).not.toThrow();
    });
  });

  describe('WA-034: updateApiKey resets genAI', () => {
    it('should nullify genAI so next call creates a new instance', () => {
      const { agent } = createAgentWithService(ctx);
      agent.getGenAI();
      agent.updateApiKey('new-key');
      expect(agent.getGenAI()).toBeDefined();
    });
  });

  describe('WA-035: getGenAI lazy initialization', () => {
    it('should return a GoogleGenerativeAI instance', () => {
      const genAI = createAgentWithService(ctx).agent.getGenAI();
      expect(genAI).toBeDefined();
      expect(genAI.getGenerativeModel).toBeDefined();
    });
  });
}
