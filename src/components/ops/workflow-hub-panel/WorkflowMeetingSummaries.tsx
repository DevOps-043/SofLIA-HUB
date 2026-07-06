export function WorkflowMeetingSummaries({ meetingDetail }: { meetingDetail: any }) {
  if (!meetingDetail) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <SummaryBox title="Resumen ejecutivo" text={meetingDetail.latest_asset?.executive_summary || 'Sin resumen ejecutivo.'} />
      <SummaryBox title="Resumen operativo" text={meetingDetail.latest_asset?.operational_summary || 'Sin resumen operativo.'} />
    </div>
  );
}

function SummaryBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 shadow-sm dark:shadow-none">
      <div className="text-[10px] uppercase tracking-wider text-secondary mb-2">{title}</div>
      <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{text}</p>
    </div>
  );
}
