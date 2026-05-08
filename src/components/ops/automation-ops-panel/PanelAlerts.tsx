export function PanelAlerts({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;

  return (
    <div className="shrink-0 px-6 pb-2 space-y-2">
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">{error}</div>}
      {notice && <div className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-2.5 text-xs text-accent">{notice}</div>}
    </div>
  );
}
