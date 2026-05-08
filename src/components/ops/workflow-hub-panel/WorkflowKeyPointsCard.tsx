export function WorkflowKeyPointsCard({ analysis }: { analysis: any }) {
  if (!analysis?.keyPoints?.length) return null;
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1c20]/50 border border-gray-200 dark:border-white/10 p-5 shadow-sm dark:shadow-lg">
      <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">Puntos clave</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {analysis.keyPoints.map((point: string, index: number) => (
          <div key={`${point}-${index}`} className="flex items-start gap-2 text-[12px] text-gray-600 dark:text-gray-300">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/60 shrink-0" />
            {point}
          </div>
        ))}
      </div>
    </div>
  );
}
