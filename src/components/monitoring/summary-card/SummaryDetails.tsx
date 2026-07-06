import type { DailySummary } from '../../../core/entities/ActivityLog';
import { SummaryActions } from './SummaryActions';
import { SummaryInsights } from './SummaryInsights';

interface SummaryDetailsProps {
  summary: DailySummary;
  generating: boolean;
  sending: boolean;
  sent: boolean;
  onGenerate: () => void;
  onSendWhatsApp: () => void;
}

export function SummaryDetails({ summary, generating, sending, sent, onGenerate, onSendWhatsApp }: SummaryDetailsProps) {
  return (
    <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700">
      <div className="relative group/text">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-accent/30 rounded-full group-hover/text:bg-accent transition-colors" />
        <div className="max-h-100 overflow-y-auto pr-4 custom-scrollbar">
          <p className="text-base text-gray-200 whitespace-pre-line leading-loose font-medium italic">"{summary.aiSummary}"</p>
        </div>
      </div>

      <SummaryInsights summary={summary} />
      <SummaryActions
        generating={generating}
        sending={sending}
        sent={sent}
        onGenerate={onGenerate}
        onSendWhatsApp={onSendWhatsApp}
      />
    </div>
  );
}
