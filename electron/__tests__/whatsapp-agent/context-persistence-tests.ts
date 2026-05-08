import { describe, expect, it } from 'vitest';
import type { WhatsAppAgentTestContext } from './types';
import { createAgentWithServices } from './types';

export function registerContextPersistenceTests(ctx: WhatsAppAgentTestContext): void {
  describe('WA-036: memory context injection', () => {
    it('should call memory.assembleContext during message processing', async () => {
      const { agent, memory } = createAgentWithServices(ctx);
      ctx.mockTextResponse('Respuesta');

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'test');
      expect(memory.assembleContext).toHaveBeenCalledWith(
        '5215500000000',
        '5215500000000',
        'test',
      );
    });
  });

  describe('WA-037: user message saved to memory', () => {
    it('should call memory.saveMessage for incoming user message', async () => {
      const { agent, memory } = createAgentWithServices(ctx);
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
      const { agent, knowledge } = createAgentWithServices(ctx);
      ctx.mockTextResponse('OK');

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'test');
      expect(knowledge.getBootstrapContext).toHaveBeenCalledWith('5215500000000');
    });
  });
}
