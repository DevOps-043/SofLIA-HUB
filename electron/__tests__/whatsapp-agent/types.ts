export type WhatsAppAgentTestContext = {
  createMockKnowledgeService: () => any;
  createMockMemoryService: () => any;
  createMockWaService: () => any;
  getWhatsAppAgent: () => any;
  mockGetGenerativeModel: any;
  mockSendMessage: any;
  mockTextResponse: (text: string) => void;
};

export {
  createAgent,
  createAgentWithService as createAgentWithServices,
} from './create-agent';
