import type { WorkflowCaseDetail } from '../../../services/workflow-hub-service';

export function MeetingAnalysisPanels({ detail }: { detail: WorkflowCaseDetail }) {
  const meetingDetail = detail.meetingDetail;
  const analysis = meetingDetail?.latest_asset?.payload.analysis_result || null;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryBlock title="Resumen ejecutivo" text={meetingDetail?.latest_asset?.executive_summary || 'Sin resumen ejecutivo.'} />
        <SummaryBlock title="Resumen operativo" text={meetingDetail?.latest_asset?.operational_summary || 'Sin resumen operativo.'} />
      </div>
      {analysis && analysis.keyPoints.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
          <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Puntos clave</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {analysis.keyPoints.map((point, index) => (
              <div key={`${point}-${index}`} className="flex items-start gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 shrink-0" />{point}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SummaryBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{title}</div>
      <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{text}</p>
    </div>
  );
}
