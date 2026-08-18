export type WhatsAppAgentTestContext = {
  createMockKnowledgeService: () => any;
  createMockMemoryService: () => any;
  createMockWaService: () => any;
  getWhatsAppAgent: () => any;
  mockChatsCreate: any;
  mockSendMessage: any;
  mockTextResponse: (text: string) => void;
};

export {
  createAgent,
  createAgentWithService as createAgentWithServices,
} from './create-agent';
