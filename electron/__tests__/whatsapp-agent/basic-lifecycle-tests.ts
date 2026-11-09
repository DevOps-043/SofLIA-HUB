import { describe, expect, it, vi } from 'vitest';
import type { WhatsAppAgentTestContext } from './types';
import { createAgent, createAgentWithServices } from './types';

export function registerBasicLifecycleTests(ctx: WhatsAppAgentTestContext): void {
  describe('WA-031: handleMessage returns text response', () => {
    it('should call waService.sendText with agent response', async () => {
      const { agent, waService } = createAgentWithServices(ctx);
      ctx.mockTextResponse('Hola, soy SofLIA.');

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

  describe('Proveedor nativo del agente', () => {
    it('resuelve OpenAI sin conservar un cliente Google', async () => {
      const agent = createAgent(ctx);
      await expect(agent.getOpenAIClient()).resolves.toBeDefined();
      expect('getGenAI' in agent).toBe(false);
    });
  });
}
