import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSendText = vi.fn().mockResolvedValue(undefined);
const mockWaService = {
  sendText: mockSendText,
};

import { MeetingWorkflowManager } from '../whatsapp-workflow-meetings';

describe('MeetingWorkflowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MeetingWorkflowManager.endWorkflow('meeting-timeout');
    MeetingWorkflowManager.endWorkflow('meeting-cancel');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancela workflows de reuniones por inactividad despues de 5 minutos', async () => {
    vi.useFakeTimers();

    await MeetingWorkflowManager.startWorkflow(
      'meeting-timeout',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      {} as any,
    );

    expect(MeetingWorkflowManager.isActive('meeting-timeout')).toBe(true);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(MeetingWorkflowManager.isActive('meeting-timeout')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(
      '5551234567@s.whatsapp.net',
      expect.stringContaining('inactividad'),
    );
  });

  it('acepta cancelar con lenguaje natural mientras el workflow esta activo', async () => {
    await MeetingWorkflowManager.startWorkflow(
      'meeting-cancel',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      {} as any,
    );

    await MeetingWorkflowManager.handleMessage('meeting-cancel', 'Cancela el flujo');

    expect(MeetingWorkflowManager.isActive('meeting-cancel')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(
      '5551234567@s.whatsapp.net',
      expect.stringContaining('cancelado'),
    );
  });
});

