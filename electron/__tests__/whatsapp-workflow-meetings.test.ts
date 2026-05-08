import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRunDetailFixture } from './whatsapp-workflow-meetings.fixture';

const mockSendText = vi.fn().mockResolvedValue(undefined);
const mockWaService = { sendText: mockSendText };

import { buildMeetingRunIntroMessage, MeetingWorkflowManager } from '../whatsapp-workflow-meetings';

describe('MeetingWorkflowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MeetingWorkflowManager.endWorkflow('meeting-timeout');
    MeetingWorkflowManager.endWorkflow('meeting-cancel');
    MeetingWorkflowManager.endWorkflow('meeting-reject');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancela workflows de reuniones por inactividad despues de 5 minutos', async () => {
    vi.useFakeTimers();
    await MeetingWorkflowManager.startWorkflow('meeting-timeout', '5551234567@s.whatsapp.net', '5551234567', mockWaService as any, {} as any);
    expect(MeetingWorkflowManager.isActive('meeting-timeout')).toBe(true);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(MeetingWorkflowManager.isActive('meeting-timeout')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith('5551234567@s.whatsapp.net', expect.stringContaining('inactividad'));
  });

  it('acepta cancelar con lenguaje natural mientras el workflow esta activo', async () => {
    await MeetingWorkflowManager.startWorkflow('meeting-cancel', '5551234567@s.whatsapp.net', '5551234567', mockWaService as any, {} as any);
    await MeetingWorkflowManager.handleMessage('meeting-cancel', 'Cancela el flujo');
    expect(MeetingWorkflowManager.isActive('meeting-cancel')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith('5551234567@s.whatsapp.net', expect.stringContaining('cancelado'));
  });

  it('acepta "rechazar" como salida natural del workflow', async () => {
    await MeetingWorkflowManager.startWorkflow('meeting-reject', '5551234567@s.whatsapp.net', '5551234567', mockWaService as any, {} as any);
    await MeetingWorkflowManager.handleMessage('meeting-reject', 'rechazar');
    expect(MeetingWorkflowManager.isActive('meeting-reject')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith('5551234567@s.whatsapp.net', expect.stringContaining('rechazado'));
  });

  it('muestra un brief de reunion con tipo, contexto y prompt operativo', () => {
    const message = buildMeetingRunIntroMessage(createRunDetailFixture());
    expect(message).toContain('Weekly Delivery Sync');
    expect(message).toContain('Tipo detectado: Delivery Weekly Sync');
    expect(message).toContain('Contexto: equipo Producto | proyecto Pulse Hub | objetivo validar avances del sprint, destrabar QA');
    expect(message).toContain('Enfoque: acuerdos, bloqueos, siguientes pasos');
    expect(message).toContain('Prompt operativo generado:');
    expect(message).toContain('Voy a priorizar acuerdos, bloqueos, siguientes pasos.');
    expect(message).toContain('responde "aprobar resumen"');
  });
});
