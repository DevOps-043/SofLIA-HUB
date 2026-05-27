import './whatsapp-agent/model-mocks';
import './whatsapp-agent/module-mocks';

export { getMockGetGenerativeModel, getMockSendMessage, mockTextResponse } from './whatsapp-agent/model-mocks';
export {
  createMockKnowledgeService,
  createMockMemoryService,
  createMockWaService,
} from './whatsapp-agent/service-fixtures';
