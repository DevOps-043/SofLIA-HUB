import { afterEach, beforeEach, describe, vi } from 'vitest';
import { registerBasicAgentTests } from './whatsapp-agent/basic-agent-tests';
import { registerCommandTests } from './whatsapp-agent/command-tests';
import { registerContextMemoryTests } from './whatsapp-agent/context-memory-tests';
import { registerDependencySetterTests } from './whatsapp-agent/dependency-setter-tests';
import { registerPassiveSkillTests } from './whatsapp-agent/passive-skill-tests';
import { registerResponseRetryTests } from './whatsapp-agent/response-retry-tests';
import { registerSecurityPrefilterTests } from './whatsapp-agent/security-prefilter-tests';
import {
  createMockKnowledgeService,
  createMockMemoryService,
  createMockWaService,
  getMockChatsCreate,
  getMockSendMessage,
  mockTextResponse,
} from './whatsapp-agent.fixtures';

let WhatsAppAgent: any;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../whatsapp-agent');
  WhatsAppAgent = mod.WhatsAppAgent;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WhatsApp Agent', () => {
  const ctx = {
    createMockKnowledgeService,
    createMockMemoryService,
    createMockWaService,
    getWhatsAppAgent: () => WhatsAppAgent,
    mockChatsCreate: getMockChatsCreate(),
    mockSendMessage: getMockSendMessage(),
    mockTextResponse,
  };

  registerBasicAgentTests(ctx);
  registerContextMemoryTests(ctx);
  registerPassiveSkillTests(ctx);
  registerCommandTests(ctx);
  registerSecurityPrefilterTests(ctx);
  registerDependencySetterTests(ctx);
  registerResponseRetryTests(ctx);
});
