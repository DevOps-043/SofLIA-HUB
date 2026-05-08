import { ClassificationCard } from './ClassificationCard';
import { DestinationCard } from './DestinationCard';
import { GovernanceCard } from './GovernanceCard';
import type { CurrentAnalysis } from './run-detail-types';

interface AnalysisStripProps {
  analysis: CurrentAnalysis | null;
}

export function AnalysisStrip({ analysis }: AnalysisStripProps) {
  if (!analysis) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <ClassificationCard analysis={analysis} />
      <DestinationCard analysis={analysis} />
      <GovernanceCard analysis={analysis} />
    </div>
  );
}
