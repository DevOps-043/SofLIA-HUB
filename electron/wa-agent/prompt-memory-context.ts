import type { KnowledgeService } from '../knowledge-service';
import type { MemoryService } from '../memory-service';

export async function buildWhatsAppPromptMemoryContext(params: {
  memory: MemoryService;
  knowledge: KnowledgeService;
  sessionKey: string;
  senderNumber: string;
  userMessage: string;
}): Promise<string> {
  let memoryContext = '';
  try {
    const memCtx = await params.memory.assembleContext(
      params.sessionKey,
      params.senderNumber,
      params.userMessage,
    );
    memoryContext = params.memory.formatContextForPrompt(memCtx);
    const hasRecent = memCtx.recentMessages?.length || 0;
    const hasSummary = memCtx.rollingSummary ? 1 : 0;
    const hasSemantic = memCtx.semanticRecall?.length || 0;
    const hasFacts = memCtx.facts?.length || 0;
    console.log(`[WhatsApp Agent] Memory context: ${hasRecent} recent msgs, ${hasSummary} summary, ${hasSemantic} semantic, ${hasFacts} facts, ${memoryContext.length} chars total`);
  } catch (err: any) {
    console.warn('[WhatsApp Agent] Memory context assembly failed:', err.message);
  }

  return memoryContext + params.knowledge.getBootstrapContext(params.senderNumber);
}
