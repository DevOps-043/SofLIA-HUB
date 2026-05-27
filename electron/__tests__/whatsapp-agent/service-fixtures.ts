import { vi } from 'vitest';

export function createMockWaService() {
  return {
    sendText: vi.fn().mockResolvedValue(undefined),
    sendFile: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getBotNumber: vi.fn().mockReturnValue('5215512345678'),
    isAllowedNumber: vi.fn().mockReturnValue(true),
    setGroupConfig: vi.fn().mockResolvedValue(undefined),
    setPersonalization: vi.fn().mockImplementation(function (this: any, update: any) {
      if (update.globalPersonalization) {
        this.config.globalPersonalization = { ...this.config.globalPersonalization, ...update.globalPersonalization };
      }
      if (update.contactPersonalizations) {
        this.config.contactPersonalizations = { ...this.config.contactPersonalizations, ...update.contactPersonalizations };
      }
      if (update.groupPersonalizations) {
        this.config.groupPersonalizations = { ...this.config.groupPersonalizations, ...update.groupPersonalizations };
      }
      return Promise.resolve();
    }),
    config: {
      allowedNumbers: [],
      whitelistEnabled: false,
      autoConnect: false,
      allowedGroups: [],
      groupPolicy: 'open',
      groupAllowFrom: [],
      groupActivation: 'mention',
      groupPrefix: '/soflia',
      globalPersonalization: {
        displayName: 'SofLIA',
        userAlias: '',
        tone: 'professional',
        responseStyle: 'Responde en espanol, de forma clara, util y respetuosa.',
        context: '',
        customInstructions: '',
        flowInstructions: 'Los flujos activos y pasivos deben ejecutarse para el remitente actual y respetar sus permisos.',
      },
      contactPersonalizations: {},
      groupPersonalizations: {},
    },
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
