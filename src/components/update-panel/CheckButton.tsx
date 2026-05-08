interface CheckButtonProps {
  checking: boolean;
  state: string;
  onCheck: () => void;
}

export function CheckButton({ checking, state, onCheck }: CheckButtonProps) {
  const isChecking = checking || state === 'checking';

  return (
    <button
      onClick={onCheck}
      disabled={isChecking || state === 'downloading'}
      className="w-full py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-black text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
    >
      {isChecking ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando actualizaciones...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Buscar actualizaciones
        </>
      )}
    </button>
  );
}
