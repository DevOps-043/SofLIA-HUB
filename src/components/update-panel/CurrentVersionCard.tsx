interface CurrentVersionCardProps {
  state: string;
  checking: boolean;
  currentVersion: string;
}

export function CurrentVersionCard({ state, checking, currentVersion }: CurrentVersionCardProps) {
  return (
    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Versión actual</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">v{currentVersion}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          state === 'available' || state === 'downloading' || state === 'downloaded'
            ? 'bg-accent/10 border border-accent/20 text-accent'
            : state === 'error'
              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          {getStatusLabel(state, checking)}
        </div>
      </div>
    </div>
  );
}

function getStatusLabel(state: string, checking: boolean) {
  if (state === 'available') return 'Actualización disponible';
  if (state === 'downloading') return 'Descargando...';
  if (state === 'downloaded') return 'Lista para instalar';
  if (state === 'checking' || checking) return 'Verificando...';
  if (state === 'error') return 'Error';
  return 'Al día';
}
