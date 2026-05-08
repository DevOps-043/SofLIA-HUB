import { ConfidenceBar, SectionTitle } from './base-components';
import type { CurrentAnalysis, RunDetail } from './run-detail-types';
import { SEVERITY_STYLES } from './styles';

interface RisksQuestionsCardProps {
  analysis: CurrentAnalysis | null;
  detail: RunDetail;
}

export function RisksQuestionsCard({ analysis, detail }: RisksQuestionsCardProps) {
  const risks = analysis?.risks || [];
  const questions = analysis?.openQuestions || [];
  const flags = detail.latest_asset?.review_flags || [];
  const count = risks.length + questions.length + flags.length;

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <SectionTitle count={count}>Riesgos y preguntas</SectionTitle>
      <div className="space-y-2">
        {risks.map((risk, index) => (
          <div key={`r-${index}`} className="rounded-xl bg-red-500/[0.03] border border-red-500/10 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <div>
                <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{risk.description}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_STYLES[risk.severity || 'medium']}`}>{risk.severity || 'medium'}</span>
                  <ConfidenceBar value={risk.confidence} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {questions.map((question, index) => (
          <div key={`q-${index}`} className="rounded-xl bg-blue-500/[0.03] border border-blue-500/10 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-1 text-blue-500 text-[12px] font-bold shrink-0">?</span>
              <div>
                <div className="text-[13px] text-gray-700 dark:text-gray-200 leading-snug">{question.question}</div>
                <div className="mt-1.5"><ConfidenceBar value={question.confidence} /></div>
              </div>
            </div>
          </div>
        ))}
        {flags.map((flag, index) => (
          <div key={`f-${index}`} className="rounded-xl bg-amber-500/[0.03] border border-amber-500/10 p-2.5 flex items-start gap-2">
            <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <div>
              <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{flag.code.replace(/_/g, ' ')}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">{flag.message}</div>
            </div>
          </div>
        ))}
        {count === 0 && (
          <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 p-3 text-center">
            <span className="text-[12px] text-emerald-600 dark:text-emerald-400">Sin riesgos ni preguntas abiertas</span>
          </div>
        )}
      </div>
    </div>
  );
}
