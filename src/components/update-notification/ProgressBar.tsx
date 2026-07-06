export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs text-secondary mb-1.5">
        <span>Descargando actualizacion</span>
        <span className="text-accent font-bold">{progress}%</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
