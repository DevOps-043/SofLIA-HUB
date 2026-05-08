const meetingRun = {
  id: 'meeting_run_1',
  owner_user_id: 'user_1',
  meeting_title: 'Comite semanal',
  meeting_type: 'operacion',
  status: 'REVIEW_REQUIRED',
  created_at: '2026-03-22T19:00:00.000Z',
  updated_at: '2026-03-22T19:05:00.000Z',
};

const reviewFlags = [{ code: 'missing_owner', message: 'Falta responsable' }];

export function buildMeetingSummary() {
  return {
    run: meetingRun,
    latest_asset: {
      id: 'asset_1',
      executive_summary: 'Resumen ejecutivo',
      operational_summary: 'Resumen operativo',
      review_flags: reviewFlags,
      created_at: '2026-03-22T19:05:00.000Z',
    },
    counts: { draft_actions: 1, approved_actions: 0, synced_actions: 0, failed_actions: 0 },
  };
}

export function buildMeetingDetail() {
  return {
    run: meetingRun,
    source_artifacts: [],
    latest_asset: {
      id: 'asset_1',
      payload: {
        executive_summary: 'Resumen ejecutivo',
        operational_summary: 'Resumen operativo',
        decisions: [],
        commitments: [],
        issues: [],
        review_flags: reviewFlags,
        proposed_actions: [{ summary: 'Crear tarea' }],
        analysis_result: {
          executiveSummary: 'Resumen ejecutivo',
          keyPoints: ['Cliente pidio seguimiento'],
          decisions: [],
          agreements: [],
          tasks: [],
          risks: [],
          openQuestions: [],
          unresolvedItems: [],
        },
      },
      executive_summary: 'Resumen ejecutivo',
      operational_summary: 'Resumen operativo',
      review_flags: reviewFlags,
    },
    sync_actions: [{
      id: 'sync_action_1',
      action_type: 'iris_task',
      summary: 'Crear tarea en IRIS',
      approval_state: 'draft',
      sync_state: 'pending',
      error_message: null,
      blocking_flags: ['missing_owner'],
      payload: { title: 'Dar seguimiento', team_id: 'team_1', project_id: 'project_1', due_date: null, assignee_id: null },
    }],
    approvals: [],
  };
}
