import { vi } from 'vitest';

export function createMockWaService() {
  return {
    sendText: vi.fn().mockResolvedValue(undefined),
    sendFile: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getBotNumber: vi.fn().mockReturnValue('5215512345678'),
    isAllowedNumber: vi.fn().mockReturnValue(true),
    setGroupConfig: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    emit: vi.fn(),
  };
}

export function createMockMemoryService() {
  return {
    assembleContext: vi.fn().mockResolvedValue({
      recentMessages: [],
      rollingSummary: null,
      semanticRecall: [],
      facts: [],
    }),
    formatContextForPrompt: vi.fn().mockReturnValue(''),
    saveMessage: vi.fn(),
    clearSessionContext: vi.fn(),
    getConversationHistory: vi.fn().mockReturnValue([]),
  };
}

export function createMockKnowledgeService() {
  return { getBootstrapContext: vi.fn().mockReturnValue('') };
}
