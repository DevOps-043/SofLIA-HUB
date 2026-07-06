export function ReadOnlyBanner({ reason }: { reason?: string | null }) {
  if (!reason) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
        {reason}
      </div>
    </div>
  );
}
