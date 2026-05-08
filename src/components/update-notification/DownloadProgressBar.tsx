export function TopProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-0.5 bg-white/5">
      <div className="h-full bg-accent transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
    </div>
  );
}

export function DownloadProgressBar({ progress }: { progress: number }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium mb-1.5">
        <span>Descargando actualizacion</span>
        <span className="text-accent font-bold">{progress}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,186,255,0.4)]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
