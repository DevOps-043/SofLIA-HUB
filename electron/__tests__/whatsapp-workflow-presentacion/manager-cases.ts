import { beforeEach, describe, expect, it } from 'vitest';
import {
  WorkflowManager,
  mockAgent,
  mockWaService,
  resetPresentationWorkflowMocks,
} from './setup';

describe('WorkflowManager', () => {
  beforeEach(resetPresentationWorkflowMocks);

  it('returns false for missing sessions', () => {
    expect(WorkflowManager.isActive('nonexistent')).toBe(false);
  });

  it('startWorkflow creates an active workflow', async () => {
    await WorkflowManager.startWorkflow(
      'mgr-test',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      mockAgent as any,
    );
    expect(WorkflowManager.isActive('mgr-test')).toBe(true);
  });

  it('endWorkflow removes an active workflow', async () => {
    await WorkflowManager.startWorkflow(
      'mgr-test',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      mockAgent as any,
    );
    WorkflowManager.endWorkflow('mgr-test');
    expect(WorkflowManager.isActive('mgr-test')).toBe(false);
  });
});
