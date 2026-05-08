import type { WhatsAppAgentTestContext } from './types';

export function createAgent(ctx: WhatsAppAgentTestContext, apiKey = 'test-key') {
  return new (ctx.getWhatsAppAgent())(
    ctx.createMockWaService(),
    apiKey,
    ctx.createMockMemoryService(),
    ctx.createMockKnowledgeService(),
  );
}

export function createAgentWithService(ctx: WhatsAppAgentTestContext) {
  const waService = ctx.createMockWaService();
  const memory = ctx.createMockMemoryService();
  const knowledge = ctx.createMockKnowledgeService();
  return {
    waService,
    memory,
    knowledge,
    agent: new (ctx.getWhatsAppAgent())(
      waService,
      'test-key',
      memory,
      knowledge,
    ),
  };
}
