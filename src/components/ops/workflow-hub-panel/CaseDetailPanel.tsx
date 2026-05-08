import type { WorkflowCaseDetail } from '../../../services/workflow-hub-service';
import { CaseDecisionPanel } from './CaseDecisionPanel';
import { CaseSummaryCard } from './CaseSummaryCard';
import { MeetingAnalysisPanels } from './MeetingAnalysisPanels';
import { SyncActionsPanel } from './SyncActionsPanel';
import type { WorkflowHubController } from './useWorkflowHubController';

export function CaseDetailPanel({
  controller,
  detail,
}: {
  controller: WorkflowHubController;
  detail: WorkflowCaseDetail;
}) {
  const meetingDetail = detail.meetingDetail;
  return (
    <div className="space-y-4">
      <CaseSummaryCard detail={detail} />
      {(detail.normalizedStatus === 'pending_approval' || meetingDetail) && (
        <CaseDecisionPanel controller={controller} detail={detail} />
      )}
      {meetingDetail && <MeetingAnalysisPanels detail={detail} />}
      {meetingDetail && <SyncActionsPanel controller={controller} detail={detail} />}
    </div>
  );
}
