import {
  describe,
  expect,
  it,
} from 'vitest';

type DependencySetterContext = {
  createMockKnowledgeService: () => any;
  createMockMemoryService: () => any;
  createMockWaService: () => any;
  getWhatsAppAgent: () => any;
};

function createAgent(ctx: DependencySetterContext) {
  return new (ctx.getWhatsAppAgent())(
    ctx.createMockWaService(),
    'test-key',
    ctx.createMockMemoryService(),
    ctx.createMockKnowledgeService(),
  );
}

export function registerDependencySetterTests(ctx: DependencySetterContext): void {
  describe('WA-046: setDesktopAgentService', () => {
    it('should accept DesktopAgentService without error', () => {
      expect(() => createAgent(ctx).setDesktopAgentService({} as any)).not.toThrow();
    });
  });

  describe('WA-047: setTaskScheduler', () => {
    it('should accept TaskScheduler without error', () => {
      expect(() => createAgent(ctx).setTaskScheduler({} as any)).not.toThrow();
    });
  });

  describe('WA-048: setNeuralOrganizer', () => {
    it('should accept NeuralOrganizerService without error', () => {
      expect(() => createAgent(ctx).setNeuralOrganizer({} as any)).not.toThrow();
    });
  });

  describe('WA-049: setClipboardAssistant', () => {
    it('should accept ClipboardAIAssistant without error', () => {
      expect(() => createAgent(ctx).setClipboardAssistant({} as any)).not.toThrow();
    });
  });

  describe('WA-050: setMeetingWorkflowService', () => {
    it('should accept MeetingWorkflowService without error', () => {
      expect(() => createAgent(ctx).setMeetingWorkflowService({} as any)).not.toThrow();
    });
  });
}
