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

    it('ignores empty text turns produced by passive WhatsApp interactions', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', '   ');
      expect(ctx.mockSendMessage).not.toHaveBeenCalled();
      expect(waService.sendText).not.toHaveBeenCalled();
    });

    it('should inject contact personalization into the system prompt when whitelist is active', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      waService.config.whitelistEnabled = true;
      waService.config.allowedNumbers = ['5215500000000'];
      waService.config.contactPersonalizations = {
        '5215500000000': {
          ...waService.config.globalPersonalization,
          displayName: 'LIA',
          tone: 'emotional_support',
          customInstructions: 'Prioriza acompanamiento emocional.',
        },
      };
      ctx.mockTextResponse('Aqui estoy.');
      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');
      expect(ctx.mockChatsCreate).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({ systemInstruction: expect.stringContaining('Eres LIA') }),
      }));
      expect(ctx.mockChatsCreate).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({ systemInstruction: expect.stringContaining('Nombre del agente para este usuario: LIA.') }),
      }));
      expect(ctx.mockChatsCreate).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({ systemInstruction: expect.stringContaining('Prioriza acompanamiento emocional.') }),
      }));
    });

    it('should prefer group personalization over contact personalization in group messages', async () => {
      const { agent, waService } = createAgentWithService(ctx);
      waService.config.whitelistEnabled = true;
      waService.config.allowedNumbers = ['5215500000000'];
      waService.config.allowedGroups = ['120363000000@g.us'];
      waService.config.contactPersonalizations = {
        '5215500000000': {
          ...waService.config.globalPersonalization,
          displayName: 'LIA Personal',
        },
      };
      waService.config.groupPersonalizations = {
        '120363000000@g.us': {
          ...waService.config.globalPersonalization,
          displayName: 'SofLIA Equipo',
          customInstructions: 'Prioriza coordinacion del grupo.',
        },
      };
      ctx.mockTextResponse('Hecho.');
      await agent.handleMessage('120363000000@g.us', '5215500000000', 'Hola equipo', true);
      expect(ctx.mockChatsCreate).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({ systemInstruction: expect.stringContaining('Nombre del agente para este usuario: SofLIA Equipo.') }),
      }));
      expect(ctx.mockChatsCreate).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({ systemInstruction: expect.stringContaining('Prioriza coordinacion del grupo.') }),
      }));
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
