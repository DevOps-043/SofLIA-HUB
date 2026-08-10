import './mocks';
import { vi } from 'vitest';
import { PresentacionWorkflow, WorkflowManager } from '../../whatsapp-workflow-presentacion';
import { mockAgent, mockFetch, mockGenAI, mockGenerateContent, mockWaService, mockWorkspaceService } from './mocks';

export { PresentacionWorkflow, WorkflowManager };
export {
  mockAgent, mockFetch, mockGenerateContent, mockSendText, mockSendFile, mockWaService,
  mockWorkspaceService, mockWriteFile, mockWriteSystemFile, mockExportHtml, mockResolveBranding,
} from './mocks';

export function resetPresentationWorkflowMocks(): void {
  vi.clearAllMocks();
  WorkflowManager.endWorkflow('test-session');
  WorkflowManager.endWorkflow('mgr-test');
  WorkflowManager.endWorkflow('mgr-timeout');
  mockWaService.isConnected.mockReturnValue(true);
  mockWaService.sendText.mockResolvedValue(undefined);
  mockAgent.getGenAI.mockReturnValue(mockGenAI);
  mockGenerateContent.mockResolvedValue({
    response: { text: () => '{"company": "TechCorp", "email": "test@techcorp.com"}' },
  });
  mockFetch.mockReset();
}

export function createPresentationWorkflow(): PresentacionWorkflow {
  return new PresentacionWorkflow(
    'test-session',
    '5551234567@s.whatsapp.net',
    '5551234567',
    mockWaService as unknown as ConstructorParameters<typeof PresentacionWorkflow>[3],
    mockAgent as unknown as ConstructorParameters<typeof PresentacionWorkflow>[4],
    mockWorkspaceService as unknown as ConstructorParameters<typeof PresentacionWorkflow>[5],
  );
}
