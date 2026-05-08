import { ConfidenceBar, SectionTitle } from './base-components';
import type { CurrentAnalysis } from './run-detail-types';

interface DecisionsAgreementsGridProps {
  analysis: CurrentAnalysis | null;
}

export function DecisionsAgreementsGrid({ analysis }: DecisionsAgreementsGridProps) {
  if (!analysis || (analysis.decisions.length === 0 && analysis.agreements.length === 0)) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {analysis.decisions.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
          <SectionTitle count={analysis.decisions.length}>Decisiones</SectionTitle>
          <div className="space-y-2">
            {analysis.decisions.map((decision, index) => (
              <div key={index} className="rounded-xl bg-violet-500/[0.03] border border-violet-500/10 p-3">
                <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{decision.description}</div>
                <div className="mt-1.5"><ConfidenceBar value={decision.confidence} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {analysis.agreements.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
          <SectionTitle count={analysis.agreements.length}>Acuerdos</SectionTitle>
          <div className="space-y-2">
            {analysis.agreements.map((agreement, index) => (
              <div key={index} className="rounded-xl bg-teal-500/[0.03] border border-teal-500/10 p-3">
                <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{agreement.description}</div>
                <div className="mt-1.5"><ConfidenceBar value={agreement.confidence} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
