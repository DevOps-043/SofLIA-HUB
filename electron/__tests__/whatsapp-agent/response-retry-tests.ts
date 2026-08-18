import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

type ResponseRetryContext = {
  createMockKnowledgeService: () => any;
  createMockMemoryService: () => any;
  createMockWaService: () => any;
  getWhatsAppAgent: () => any;
  mockSendMessage: any;
};

function createAgent(ctx: ResponseRetryContext) {
  const waService = ctx.createMockWaService();
  return {
    agent: new (ctx.getWhatsAppAgent())(
      waService,
      'test-key',
      ctx.createMockMemoryService(),
      ctx.createMockKnowledgeService(),
    ),
    waService,
  };
}

export function registerResponseRetryTests(ctx: ResponseRetryContext): void {
  describe('WA-051: action requests force execution instead of vague promises', () => {
    it('retries when the model promises future work without executing a tool', async () => {
      const waService = ctx.createMockWaService();
      const agent = new (ctx.getWhatsAppAgent())(
        waService,
        'test-key',
        ctx.createMockMemoryService(),
        ctx.createMockKnowledgeService(),
      );
      const { detectActionRequest } = await import('../../whatsapp-prompts');
      const { executeWhatsAppTools } = await import('../../whatsapp-tool-executor');

      vi.mocked(detectActionRequest).mockReturnValue(true);
      vi.mocked(executeWhatsAppTools).mockResolvedValueOnce({
        responses: [{ functionResponse: { name: 'web_search', response: { success: true, results: 'Capitulo 5 del CCNA' } } }],
        bulkLabelsToVerify: null,
      });

      ctx.mockSendMessage
        .mockResolvedValueOnce({ text: 'Voy a investigar en la web y te comparto el resultado.', candidates: [{ content: { parts: [{ text: 'Voy a investigar en la web y te comparto el resultado.' }] } }], functionCalls: undefined })
        .mockResolvedValueOnce({ text: '', candidates: [{ content: { parts: [{ functionCall: { name: 'web_search', args: { query: 'capitulo 5 cisco ccna titulo' } } }] } }], functionCalls: undefined })
        .mockResolvedValueOnce({ text: 'El capitulo 5 cubre conceptos de switching.', candidates: [{ content: { parts: [{ text: 'El capitulo 5 cubre conceptos de switching.' }] } }], functionCalls: undefined });

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Ayudame a investigar de que trata el capitulo 5 del CCNA');

      expect(executeWhatsAppTools).toHaveBeenCalled();
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'El capitulo 5 cubre conceptos de switching.');
    });
  });

  describe('WA-052: generic help response is retried for substantive messages', () => {
    it('retries when the model answers a non-greeting with a generic help prompt', async () => {
      const { agent, waService } = createAgent(ctx);
      const { detectActionRequest } = await import('../../whatsapp-prompts');
      vi.mocked(detectActionRequest).mockReturnValue(false);
      ctx.mockSendMessage
        .mockResolvedValueOnce({ text: 'Â¿En quÃ© puedo ayudarte?', candidates: [{ content: { parts: [{ text: 'Â¿En quÃ© puedo ayudarte?' }] } }], functionCalls: undefined })
        .mockResolvedValueOnce({ text: 'Dime cuales errores viste y los reviso contigo.', candidates: [{ content: { parts: [{ text: 'Dime cuales errores viste y los reviso contigo.' }] } }], functionCalls: undefined });

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Tienes errores');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'Dime cuales errores viste y los reviso contigo.');
    });
  });

  describe('WA-053: non-action turns cannot trigger operational tools', () => {
    it('blocks unsolicited confirmations, processes, and file flows', async () => {
      const { agent, waService } = createAgent(ctx);
      const { detectActionRequest } = await import('../../whatsapp-prompts');
      const { executeWhatsAppTools } = await import('../../whatsapp-tool-executor');

      vi.mocked(detectActionRequest).mockReturnValue(false);
      ctx.mockSendMessage
        .mockResolvedValueOnce({
          text: '',
          candidates: [{ content: { parts: [{ functionCall: { name: 'execute_command', args: { command: 'mysql --version' } } }] } }],
          functionCalls: undefined,
        })
        .mockResolvedValueOnce({
          text: 'Te leo. No inicio procesos si no me lo pides.',
          candidates: [{ content: { parts: [{ text: 'Te leo. No inicio procesos si no me lo pides.' }] } }],
          functionCalls: undefined,
        });

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');

      expect(executeWhatsAppTools).not.toHaveBeenCalled();
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'Te leo. No inicio procesos si no me lo pides.');
    });

    it('blocks unsolicited SofLIA internal chat lookups but preserves text-only personalization', async () => {
      const { agent, waService } = createAgent(ctx);
      const { detectActionRequest } = await import('../../whatsapp-prompts');
      const { executeWhatsAppTools } = await import('../../whatsapp-tool-executor');

      vi.mocked(detectActionRequest).mockReturnValue(false);
      ctx.mockSendMessage
        .mockResolvedValueOnce({
          text: '',
          candidates: [{ content: { parts: [{ functionCall: { name: 'app_chat_get_context', args: { conversationRef: 'Codex' } } }] } }],
          functionCalls: undefined,
        })
        .mockResolvedValueOnce({
          text: 'Aqui estoy contigo, sin abrir SofLIA ni revisar chats internos.',
          candidates: [{ content: { parts: [{ text: 'Aqui estoy contigo, sin abrir SofLIA ni revisar chats internos.' }] } }],
          functionCalls: undefined,
        });

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');

      expect(executeWhatsAppTools).not.toHaveBeenCalled();
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'Aqui estoy contigo, sin abrir SofLIA ni revisar chats internos.');
    });

    it('sanitizes leaked tool planning from final WhatsApp text', async () => {
      const { agent, waService } = createAgent(ctx);

      ctx.mockSendMessage.mockResolvedValueOnce({
        text: [
          'Hola, Teffy. Aqui estoy contigo.',
          '',
          'custom_theme: {"colors":{"bg":"FAF6F0"}}',
          '* include_images: true',
          'Wait, should I call create_document now? Yes!',
        ].join('\n'),
        candidates: [{
          content: {
            parts: [{
              text: [
                'Hola, Teffy. Aqui estoy contigo.',
                '',
                'custom_theme: {"colors":{"bg":"FAF6F0"}}',
                '* include_images: true',
                'Wait, should I call create_document now? Yes!',
              ].join('\n'),
            }],
          },
        }],
        functionCalls: undefined,
      });

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Hola');

      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'Hola, Teffy. Aqui estoy contigo.');
    });
  });
}
