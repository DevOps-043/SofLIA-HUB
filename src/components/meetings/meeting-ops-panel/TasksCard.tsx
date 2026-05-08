import { ConfidenceBar, EmptyState, SectionTitle } from './base-components';
import type { CurrentAnalysis, RunDetail } from './run-detail-types';
import { PRIORITY_STYLES } from './styles';

interface TasksCardProps {
  analysis: CurrentAnalysis | null;
  detail: RunDetail;
}

export function TasksCard({ analysis, detail }: TasksCardProps) {
  const tasks = analysis?.tasks || [];
  const commitments = detail.latest_asset?.payload.commitments || [];

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <SectionTitle count={(analysis?.tasks || commitments).length}>Tareas</SectionTitle>
      <div className="space-y-2">
        {tasks.length === 0 && commitments.length === 0 && <EmptyState text="Sin tareas detectadas" />}
        {tasks.map((task, index) => (
          <div key={index} className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3 space-y-2">
            <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{task.description}</div>
            <div className="flex flex-wrap gap-1.5">
              {task.prioritySuggested && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_STYLES[task.prioritySuggested] || PRIORITY_STYLES.medium}`}>
                  {task.prioritySuggested}
                </span>
              )}
              {task.ownerSuggested && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{task.ownerSuggested}</span>}
              {task.dueDateSuggested && <span className="text-[10px] bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{task.dueDateSuggested}</span>}
              {task.requiresHumanReview && <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded">Rev. humana</span>}
            </div>
            <ConfidenceBar value={task.confidence} />
            <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{task.reason}</div>
          </div>
        ))}
        {!analysis && commitments.map((commitment, index) => (
          <div key={index} className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.04] p-3">
            <div className="text-[13px] text-gray-700 dark:text-gray-200">{commitment.statement}</div>
            <div className="mt-1.5 flex gap-1.5 text-[10px]">
              {commitment.owner_candidate && <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{commitment.owner_candidate}</span>}
              {commitment.due_date_candidate && <span className="bg-gray-100 dark:bg-white/[0.04] text-gray-500 px-1.5 py-0.5 rounded">{commitment.due_date_candidate}</span>}
              <span className="bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">{commitment.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
