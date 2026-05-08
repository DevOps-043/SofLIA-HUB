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
        .mockResolvedValueOnce({ response: { text: () => 'Voy a investigar en la web y te comparto el resultado.', candidates: [{ content: { parts: [{ text: 'Voy a investigar en la web y te comparto el resultado.' }] } }], functionCalls: () => null } })
        .mockResolvedValueOnce({ response: { text: () => '', candidates: [{ content: { parts: [{ functionCall: { name: 'web_search', args: { query: 'capitulo 5 cisco ccna titulo' } } }] } }], functionCalls: () => null } })
        .mockResolvedValueOnce({ response: { text: () => 'El capitulo 5 cubre conceptos de switching.', candidates: [{ content: { parts: [{ text: 'El capitulo 5 cubre conceptos de switching.' }] } }], functionCalls: () => null } });

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
        .mockResolvedValueOnce({ response: { text: () => 'Â¿En quÃ© puedo ayudarte?', candidates: [{ content: { parts: [{ text: 'Â¿En quÃ© puedo ayudarte?' }] } }], functionCalls: () => null } })
        .mockResolvedValueOnce({ response: { text: () => 'Dime cuales errores viste y los reviso contigo.', candidates: [{ content: { parts: [{ text: 'Dime cuales errores viste y los reviso contigo.' }] } }], functionCalls: () => null } });

      await agent.handleMessage('123@s.whatsapp.net', '5215500000000', 'Tienes errores');
      expect(waService.sendText).toHaveBeenCalledWith('123@s.whatsapp.net', 'Dime cuales errores viste y los reviso contigo.');
    });
  });
}
