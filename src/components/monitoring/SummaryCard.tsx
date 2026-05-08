import type { DailySummary, ActivityLog } from '../../core/entities/ActivityLog';
import { EmptySummaryState } from './summary-card/EmptySummaryState';
import { SummaryFooterActions } from './summary-card/SummaryFooterActions';
import { SummaryHeader } from './summary-card/SummaryHeader';
import { SummaryInsights } from './summary-card/SummaryInsights';
import { useSummaryActions } from './summary-card/useSummaryActions';

interface SummaryCardProps {
  summary: DailySummary | null;
  userId: string;
  logs: ActivityLog[];
  selectedDate: string;
  onSummaryGenerated: (summary: DailySummary) => void;
}

export function SummaryCard(props: SummaryCardProps) {
  const { summary, logs } = props;
  const actions = useSummaryActions(props);

  return (
    <div className="relative overflow-hidden group/summary">
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
      <div className="p-8">
        <SummaryHeader hasSummary={!!summary?.aiSummary} />
        {!summary ? (
          <EmptySummaryState
            generating={actions.generating}
            hasLogs={logs.length > 0}
            onGenerate={actions.handleGenerate}
          />
        ) : (
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700">
            <SummaryInsights summary={summary} />
            <SummaryFooterActions
              generating={actions.generating}
              sending={actions.sending}
              sent={actions.sent}
              onGenerate={actions.handleGenerate}
              onSendWhatsApp={actions.handleSendWhatsApp}
            />
          </div>
        )}
      </div>

      {actions.error && (
        <div className="absolute bottom-4 left-8 right-8 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-bounce">
          <p className="text-[10px] text-red-500 font-black text-center uppercase tracking-widest">{actions.error}</p>
        </div>
      )}
    </div>
  );
}
