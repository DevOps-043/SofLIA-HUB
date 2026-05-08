import { ConfidenceBar } from './base-components';
import type { CurrentAnalysis } from './run-detail-types';
import { DESTINATION_STYLES } from './styles';

interface DestinationCardProps {
  analysis: CurrentAnalysis;
}

export function DestinationCard({ analysis }: DestinationCardProps) {
  const destination = analysis.destinationRecommendation.suggestedDestination;
  const style = DESTINATION_STYLES[destination] || DESTINATION_STYLES.None;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Destino recomendado</div>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-7 h-7 rounded-lg ${style.bg} ${style.text} flex items-center justify-center text-[11px] font-bold`}>{style.icon}</span>
        <span className="text-[14px] font-semibold text-gray-900 dark:text-white">{destination}</span>
      </div>
      <ConfidenceBar value={analysis.destinationRecommendation.confidence} size="lg" />
      <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">{analysis.destinationRecommendation.reason}</p>
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">Follow-up</div>
        {analysis.followUpRecommendation.suggested ? (
          <div className="flex items-start gap-1.5">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-[12px] text-gray-500 dark:text-gray-400">
              {analysis.followUpRecommendation.description || analysis.followUpRecommendation.type || 'Sugerido'}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-gray-400 dark:text-gray-500">No requerido</span>
        )}
      </div>
    </div>
  );
}
