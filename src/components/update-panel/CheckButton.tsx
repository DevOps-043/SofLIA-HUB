interface CheckButtonProps {
  checking: boolean;
  state: string;
  onCheck: () => void;
}

export function CheckButton({ checking, state, onCheck }: CheckButtonProps) {
  const isChecking = checking || state === 'checking';
  const isDisabled = isChecking || state === 'downloading';

  return (
    <button
      onClick={onCheck}
      disabled={isDisabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-on-accent text-xs font-medium transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100"
    >
      {isChecking ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando…
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Buscar actualizaciones
        </>
      )}
    </button>
  );
}
