import './mocks';
import { vi } from 'vitest';
import { PresentacionWorkflow, WorkflowManager } from '../../whatsapp-workflow-presentacion';
import { mockAgent, mockFetch, mockGenAI, mockGenerateContent, mockWaService } from './mocks';

export { PresentacionWorkflow, WorkflowManager };
export { mockAgent, mockFetch, mockGenerateContent, mockSendText, mockWaService } from './mocks';

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
  delete process.env.VITE_GAMMA_API_KEY;
  delete process.env.GAMMA_API_KEY;
}

export function createPresentationWorkflow(): PresentacionWorkflow {
  return new PresentacionWorkflow(
    'test-session',
    '5551234567@s.whatsapp.net',
    '5551234567',
    mockWaService as any,
    mockAgent as any,
  );
}
