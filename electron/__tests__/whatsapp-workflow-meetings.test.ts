import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MeetingRunDetail } from '../meetings/meeting-types';

const mockSendText = vi.fn().mockResolvedValue(undefined);
const mockWaService = {
  sendText: mockSendText,
};

import { buildMeetingRunIntroMessage, MeetingWorkflowManager } from '../whatsapp-workflow-meetings';

function createRunDetailFixture(): MeetingRunDetail {
  return {
    run: {
      id: 'mrun_test_123',
      organization_id: null,
      workspace_id: null,
      owner_user_id: '5551234567',
      origin_channel: 'system',
      origin_ref: 'drive:test',
      meeting_title: 'Weekly Delivery Sync',
      meeting_type: 'delivery_weekly_sync',
      meeting_series_key: null,
      primary_source_uri: null,
      status: 'REVIEW_REQUIRED',
      source_hash: 'hash',
      source_version: 1,
      trace_id: 'trace-1',
      last_error: null,
      created_at: '2026-03-25T10:00:00.000Z',
      updated_at: '2026-03-25T10:05:00.000Z',
    },
    source_artifacts: [],
    latest_asset: {
      id: 'asset-1',
      meeting_run_id: 'mrun_test_123',
      schema_version: 'meeting_asset.v1',
      asset_version: 1,
      executive_summary: 'Se revisaron avances del sprint, bloqueos de QA y acuerdos para cerrar pendientes hoy.',
      operational_summary: 'Seguimiento semanal con foco en entrega y riesgos.',
      review_flags: [],
      confidence: 0.88,
      created_at: '2026-03-25T10:05:00.000Z',
      payload: {
        schema_version: 'meeting_asset.v1',
        meeting_run_id: 'mrun_test_123',
        trace_id: 'trace-1',
        meeting_title: 'Weekly Delivery Sync',
        meeting_type: 'delivery_weekly_sync',
        source_refs: [],
        participants: [],
        decisions: [],
        commitments: [],
        issues: [],
        open_questions: [],
        parking_lot: [],
        executive_summary: 'Se revisaron avances del sprint, bloqueos de QA y acuerdos para cerrar pendientes hoy.',
        operational_summary: 'Seguimiento semanal con foco en entrega y riesgos.',
        review_flags: [],
        proposed_actions: [],
        continuity_context: [],
        analysis_result: {
          meetingType: {
            suggestedType: 'delivery_weekly_sync',
            alternativeTypes: [],
            confidence: 0.88,
            reason: 'Coinciden senales de seguimiento semanal, bloqueos y cierre operativo.',
          },
          detectedContext: {
            project: 'Pulse Hub',
            team: 'Producto',
            meetingObjective: ['validar avances del sprint', 'destrabar QA'],
            relevantSignals: ['lenguaje:seguimiento', 'estructura:bloqueos'],
          },
          analysisStrategy: {
            strategyId: 'delivery_weekly_sync',
            strategyName: 'Delivery Weekly Sync',
            whyThisStrategy: 'La estrategia de Delivery Weekly Sync prioriza acuerdos, bloqueos y siguientes pasos.',
            extractionFocus: ['acuerdos', 'bloqueos', 'siguientes pasos'],
          },
          executiveSummary: 'Se revisaron avances del sprint, bloqueos de QA y acuerdos para cerrar pendientes hoy.',
          keyPoints: [],
          decisions: [],
          agreements: [],
          tasks: [],
          risks: [],
          openQuestions: [],
          unresolvedItems: [],
          followUpRecommendation: {
            suggested: true,
            type: 'validation',
            description: 'Validar cierre de pendientes al final del dia.',
            confidence: 0.72,
            reason: 'Hay tareas abiertas que requieren confirmacion.',
          },
          destinationRecommendation: {
            suggestedDestination: 'Project Hub',
            confidence: 0.8,
            reason: 'La reunion impacta el seguimiento operativo del proyecto.',
          },
          messageDrafts: [],
          governance: {
            autonomyLevelApplied: 2,
            sensitiveActionsBlocked: [],
            requiresHumanApproval: true,
            explanationVisible: true,
          },
        },
      },
    },
    sync_actions: [],
    approvals: [],
  };
}

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

  it('acepta "rechazar" como salida natural del workflow', async () => {
    await MeetingWorkflowManager.startWorkflow(
      'meeting-reject',
      '5551234567@s.whatsapp.net',
      '5551234567',
      mockWaService as any,
      {} as any,
    );

    await MeetingWorkflowManager.handleMessage('meeting-reject', 'rechazar');

    expect(MeetingWorkflowManager.isActive('meeting-reject')).toBe(false);
    expect(mockSendText).toHaveBeenCalledWith(
      '5551234567@s.whatsapp.net',
      expect.stringContaining('rechazado'),
    );
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
