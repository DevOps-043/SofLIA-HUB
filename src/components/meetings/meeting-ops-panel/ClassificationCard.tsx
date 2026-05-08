import { ConfidenceBar } from './base-components';
import type { CurrentAnalysis } from './run-detail-types';

interface ClassificationCardProps {
  analysis: CurrentAnalysis;
}

export function ClassificationCard({ analysis }: ClassificationCardProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Clasificacion</div>
      <div className="text-[14px] font-semibold text-gray-900 dark:text-white mb-1">
        {analysis.meetingType.suggestedType.replace(/_/g, ' ')}
      </div>
      <ConfidenceBar value={analysis.meetingType.confidence} size="lg" />
      <p className="mt-2 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">{analysis.meetingType.reason}</p>
      {analysis.meetingType.alternativeTypes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {analysis.meetingType.alternativeTypes.map((alternative) => (
            <span key={alternative.type} className="inline-flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">
              {alternative.type.replace(/_/g, ' ')}
              <span className="text-gray-400 dark:text-gray-600">{Math.round(alternative.confidence * 100)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
