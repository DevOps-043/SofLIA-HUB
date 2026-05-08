import { ConfidenceBar, SectionTitle } from './base-components';
import type { CurrentAnalysis } from './run-detail-types';

interface UnresolvedItemsCardProps {
  analysis: CurrentAnalysis | null;
}

export function UnresolvedItemsCard({ analysis }: UnresolvedItemsCardProps) {
  if (!analysis || analysis.unresolvedItems.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <SectionTitle count={analysis.unresolvedItems.length}>Temas pendientes</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {analysis.unresolvedItems.map((item, index) => (
          <div key={index} className="rounded-xl bg-orange-500/[0.03] border border-orange-500/10 p-3">
            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{item.item}</div>
            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{item.reasonOpen}</div>
            <div className="mt-1.5"><ConfidenceBar value={item.confidence} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
