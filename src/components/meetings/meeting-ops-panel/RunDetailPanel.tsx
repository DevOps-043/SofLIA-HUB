import { AnalysisStrip } from './AnalysisStrip';
import { DecisionsAgreementsGrid } from './DecisionsAgreementsGrid';
import { KeyPointsCard } from './KeyPointsCard';
import { RisksQuestionsCard } from './RisksQuestionsCard';
import { RunHeaderCard } from './RunHeaderCard';
import { SummaryCards } from './SummaryCards';
import { SyncActionsCard } from './SyncActionsCard';
import { TasksCard } from './TasksCard';
import { UnresolvedItemsCard } from './UnresolvedItemsCard';
import type { FormClassNames, MeetingOpsState } from './run-detail-types';

interface RunDetailPanelProps extends FormClassNames {
  state: MeetingOpsState;
}

export function RunDetailPanel({ inputClass, selectClass, state }: RunDetailPanelProps) {
  const { currentAnalysis, detail } = state;
  if (!detail) return null;

  return (
    <div className="mt-4 space-y-4">
      <RunHeaderCard
        detail={detail}
        onApproveActions={() => void state.handleApproveActions()}
        onApproveAsset={() => void state.handleApproveAsset()}
        onSyncActions={() => void state.handleSyncActions()}
      />
      <AnalysisStrip analysis={currentAnalysis} />
      <SummaryCards detail={detail} />
      <KeyPointsCard analysis={currentAnalysis} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TasksCard analysis={currentAnalysis} detail={detail} />
        <RisksQuestionsCard analysis={currentAnalysis} detail={detail} />
      </div>
      <SyncActionsCard detail={detail} inputClass={inputClass} selectClass={selectClass} state={state} />
      <DecisionsAgreementsGrid analysis={currentAnalysis} />
      <UnresolvedItemsCard analysis={currentAnalysis} />
    </div>
  );
}
