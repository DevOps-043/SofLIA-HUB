type Props = {
  state: string;
  checking: boolean;
};

const labelByState: Record<string, string> = {
  available: 'Actualizacion disponible',
  checking: 'Verificando...',
  downloaded: 'Lista para instalar',
  downloading: 'Descargando...',
  error: 'Error',
};

export function StatusBadge({ state, checking }: Props) {
  const tone = state === 'available' || state === 'downloading' || state === 'downloaded'
    ? 'bg-accent/10 border border-accent/20 text-accent'
    : state === 'error'
      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400';

  return (
    <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {checking ? 'Verificando...' : labelByState[state] || 'Al dia'}
    </div>
  );
}
